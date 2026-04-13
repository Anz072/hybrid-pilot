import React from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";
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

const KeyboardAwareScrollView = React.forwardRef<
  ScrollView,
  KeyboardAwareScrollViewProps
>(
  (
    {
      automaticallyAdjustKeyboardInsets = true,
      focusedInputBottomOffset = 24,
      keyboardDismissMode = Platform.OS === "ios" ? "interactive" : "on-drag",
      keyboardShouldPersistTaps = "handled",
      onScroll,
      scrollEventThrottle = 16,
      ...props
    },
    forwardedRef,
  ) => {
    const scrollRef = React.useRef<ScrollView>(null);
    const scrollYRef = React.useRef(0);
    const keyboardTopRef = React.useRef<number | null>(null);
    const focusTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null,
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
      const keyboardTop = keyboardTopRef.current;
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
          const safeTop = scrollViewY + focusedInputBottomOffset;
          const safeBottom = keyboardTop - focusedInputBottomOffset;

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
    }, [focusedInputBottomOffset]);

    const scheduleFocusedInputScroll = React.useCallback(() => {
      clearScheduledFocusScroll();
      focusTimeoutRef.current = setTimeout(() => {
        ensureFocusedInputVisible();
      }, FOCUS_SCROLL_DELAY_MS);
    }, [clearScheduledFocusScroll, ensureFocusedInputVisible]);

    React.useEffect(() => {
      const handleKeyboardShow = Keyboard.addListener(
        Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
        (event) => {
          keyboardTopRef.current = event.endCoordinates.screenY;
          scheduleFocusedInputScroll();
        },
      );

      const handleKeyboardHide = Keyboard.addListener(
        Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
        () => {
          keyboardTopRef.current = null;
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
        handleKeyboardHide.remove();
        unsubscribeFocus();
        clearScheduledFocusScroll();
      };
    }, [clearScheduledFocusScroll, scheduleFocusedInputScroll]);

    const handleScroll = React.useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollYRef.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      },
      [onScroll],
    );

    return (
      <ScrollView
        ref={scrollRef}
        automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle}
        {...props}
      />
    );
  },
);

KeyboardAwareScrollView.displayName = "KeyboardAwareScrollView";

export default KeyboardAwareScrollView;
