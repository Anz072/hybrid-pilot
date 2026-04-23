import React from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type LayoutChangeEvent,
  type ScrollViewProps,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeToTextInputFocus } from "../theme/textInputFocusEvents";

type KeyboardAwareScrollViewProps = ScrollViewProps & {
  focusedInputBottomOffset?: number;
};

type Measurable = {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

const FOCUS_SCROLL_DELAY_MS = 48;
const MIN_FOCUSED_INPUT_BOTTOM_OFFSET = 64;
const DEFAULT_EXTRA_BOTTOM_CLEARANCE = 44;

const getNumericStyleValue = (value: unknown): number =>
  typeof value === "number" ? value : 0;

const getBasePaddingBottom = (
  style: ScrollViewProps["contentContainerStyle"],
): number => {
  const flattenedStyle = StyleSheet.flatten(style) as ViewStyle | undefined;

  if (!flattenedStyle) {
    return 0;
  }

  return (
    getNumericStyleValue(flattenedStyle.paddingBottom) ||
    getNumericStyleValue(flattenedStyle.paddingVertical) ||
    getNumericStyleValue(flattenedStyle.padding)
  );
};

const KeyboardAwareScrollView = React.forwardRef<
  ScrollView,
  KeyboardAwareScrollViewProps
>(
  (
    {
      automaticallyAdjustKeyboardInsets = true,
      focusedInputBottomOffset = 24,
      contentContainerStyle,
      keyboardDismissMode = Platform.OS === "ios" ? "interactive" : "on-drag",
      keyboardShouldPersistTaps = "handled",
      onContentSizeChange,
      onLayout,
      onScroll,
      scrollIndicatorInsets,
      scrollEventThrottle = 16,
      ...props
    },
    forwardedRef,
  ) => {
    const insets = useSafeAreaInsets();
    const windowHeight = useWindowDimensions().height;
    const scrollRef = React.useRef<ScrollView>(null);
    const scrollYRef = React.useRef(0);
    const keyboardTopRef = React.useRef<number | null>(null);
    const keyboardHeightRef = React.useRef(0);
    const focusTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );
    const [keyboardSpacer, setKeyboardSpacer] = React.useState(0);

    const effectiveFocusedInputBottomOffset = React.useMemo(
      () =>
        Math.max(
          focusedInputBottomOffset,
          insets.bottom + DEFAULT_EXTRA_BOTTOM_CLEARANCE,
          MIN_FOCUSED_INPUT_BOTTOM_OFFSET,
        ),
      [focusedInputBottomOffset, insets.bottom],
    );

    const resolvedContentContainerStyle = React.useMemo(
      () => [
        contentContainerStyle,
        keyboardSpacer > 0
          ? {
              paddingBottom:
                getBasePaddingBottom(contentContainerStyle) + keyboardSpacer,
            }
          : null,
      ],
      [contentContainerStyle, keyboardSpacer],
    );

    const resolvedScrollIndicatorInsets = React.useMemo(
      () => ({
        ...scrollIndicatorInsets,
        bottom: (scrollIndicatorInsets?.bottom ?? 0) + keyboardSpacer,
      }),
      [keyboardSpacer, scrollIndicatorInsets],
    );

    React.useImperativeHandle(
      forwardedRef,
      () => scrollRef.current as ScrollView,
      [],
    );

    const clearScheduledFocusScroll = React.useCallback(() => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }
    }, []);

    const ensureFocusedInputVisible = React.useCallback(() => {
      const keyboardTop =
        keyboardTopRef.current ??
        (keyboardHeightRef.current > 0
          ? windowHeight - keyboardHeightRef.current
          : null);
      const scrollView = scrollRef.current as (ScrollView & Measurable) | null;
      const focusedInput = (TextInput.State as unknown as {
        currentlyFocusedInput?: () => Measurable | null;
      }).currentlyFocusedInput?.();

      if (keyboardTop == null || !scrollView?.measureInWindow) {
        return;
      }

      if (!focusedInput?.measureInWindow) {
        return;
      }

      scrollView.measureInWindow((_x, scrollViewY) => {
        focusedInput.measureInWindow?.((_ix, inputY, _inputWidth, inputHeight) => {
          const inputBottom = inputY + inputHeight;
          const safeTop = scrollViewY + effectiveFocusedInputBottomOffset;
          const safeBottom = keyboardTop - effectiveFocusedInputBottomOffset;

          if (inputBottom > safeBottom) {
            scrollView.scrollTo?.({
              y: Math.max(0, scrollYRef.current + (inputBottom - safeBottom)),
              animated: true,
            });
            return;
          }

          if (inputY < safeTop) {
            scrollView.scrollTo?.({
              y: Math.max(0, scrollYRef.current - (safeTop - inputY)),
              animated: true,
            });
          }
        });
      });
    }, [effectiveFocusedInputBottomOffset, windowHeight]);

    const scheduleFocusedInputScroll = React.useCallback(() => {
      clearScheduledFocusScroll();
      focusTimeoutRef.current = setTimeout(() => {
        ensureFocusedInputVisible();
      }, FOCUS_SCROLL_DELAY_MS);
    }, [clearScheduledFocusScroll, ensureFocusedInputVisible]);

    React.useEffect(() => {
      const updateKeyboardMetrics = (screenY: number | null, height: number) => {
        keyboardTopRef.current = screenY;
        keyboardHeightRef.current = height;
        setKeyboardSpacer(
          height > 0
            ? Platform.OS === "ios"
              ? effectiveFocusedInputBottomOffset
              : height + effectiveFocusedInputBottomOffset
            : 0,
        );
      };

      const handleKeyboardShow = Keyboard.addListener(
        Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
        (event) => {
          updateKeyboardMetrics(
            event.endCoordinates.screenY ?? null,
            event.endCoordinates.height ?? 0,
          );
          scheduleFocusedInputScroll();
        },
      );

      const handleKeyboardChangeFrame =
        Platform.OS === "ios"
          ? Keyboard.addListener("keyboardWillChangeFrame", (event) => {
              updateKeyboardMetrics(
                event.endCoordinates.screenY ?? null,
                event.endCoordinates.height ?? 0,
              );
              scheduleFocusedInputScroll();
            })
          : null;

      const handleKeyboardHide = Keyboard.addListener(
        Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
        () => {
          updateKeyboardMetrics(null, 0);
          clearScheduledFocusScroll();
        },
      );

      const unsubscribeFocus = subscribeToTextInputFocus(() => {
        if (keyboardTopRef.current == null) {
          return;
        }

        scheduleFocusedInputScroll();
      });

      return () => {
        handleKeyboardShow.remove();
        handleKeyboardChangeFrame?.remove();
        handleKeyboardHide.remove();
        unsubscribeFocus();
        clearScheduledFocusScroll();
      };
    }, [
      clearScheduledFocusScroll,
      effectiveFocusedInputBottomOffset,
      scheduleFocusedInputScroll,
    ]);

    const handleScroll = React.useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollYRef.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      },
      [onScroll],
    );

    const handleLayout = React.useCallback(
      (event: LayoutChangeEvent) => {
        onLayout?.(event);

        if (keyboardHeightRef.current > 0) {
          scheduleFocusedInputScroll();
        }
      },
      [onLayout, scheduleFocusedInputScroll],
    );

    const handleContentSizeChange = React.useCallback(
      (width: number, height: number) => {
        onContentSizeChange?.(width, height);

        if (keyboardHeightRef.current > 0) {
          scheduleFocusedInputScroll();
        }
      },
      [onContentSizeChange, scheduleFocusedInputScroll],
    );

    return (
      <ScrollView
        ref={scrollRef}
        automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
        contentContainerStyle={resolvedContentContainerStyle}
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        onScroll={handleScroll}
        scrollIndicatorInsets={resolvedScrollIndicatorInsets}
        scrollEventThrottle={scrollEventThrottle}
        {...props}
      />
    );
  },
);

KeyboardAwareScrollView.displayName = "KeyboardAwareScrollView";

export default KeyboardAwareScrollView;
