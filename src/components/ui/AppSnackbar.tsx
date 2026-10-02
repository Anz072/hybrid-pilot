import React from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { CheckIcon, XIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";
import { appMotion, appRadius, appSpacing } from "../../theme/tokens";
import { useReducedMotion } from "../../theme/useReducedMotion";
import { AppButton, IconButton } from "./AppButton";
import { AppText } from "./AppText";

export type SnackbarNotice = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  pending?: boolean;
};

type AppSnackbarProps = {
  notice: SnackbarNotice | null;
  onDismiss: (notice: SnackbarNotice) => void;
};

const CONFIRMATION_MS = 2500;
const ACTION_MS = 4500;
const SWIPE_THRESHOLD = 72;

/** Mount inside the screen viewport, which already ends above the tab bar. */
export const AppSnackbar = ({ notice, onDismiss }: AppSnackbarProps) => {
  const [displayed, setDisplayed] = React.useState(notice);
  const [screenReader, setScreenReader] = React.useState(false);
  const [focused, setFocused] = React.useState<"action" | "close" | null>(null);
  const reducedMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const progress = React.useRef(new Animated.Value(0)).current;
  const drag = React.useRef(new Animated.Value(0)).current;
  const direction = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const duration = React.useRef(CONFIRMATION_MS);
  const current = React.useRef(notice);
  const dismissCallback = React.useRef(onDismiss);
  current.current = notice;
  dismissCallback.current = onDismiss;

  const clearTimer = React.useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const dismiss = React.useCallback((target: SnackbarNotice, swipeDirection = 0) => {
    // A timeout or completed gesture must never dismiss a newer notification.
    if (current.current !== target) return;
    clearTimer();
    direction.current = swipeDirection;
    dismissCallback.current(target);
  }, [clearTimer]);

  const startTimer = React.useCallback(() => {
    clearTimer();
    const target = current.current;
    if (!target || target.pending || screenReader || focused) return;
    timer.current = setTimeout(() => dismiss(target), duration.current);
  }, [clearTimer, dismiss, focused, screenReader]);

  React.useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (active) setScreenReader(enabled);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    return () => { active = false; subscription.remove(); };
  }, []);

  React.useEffect(() => {
    let active = true;
    clearTimer();
    if (!notice) return;
    const baseDuration = notice.onAction && notice.actionLabel ? ACTION_MS : CONFIRMATION_MS;
    duration.current = baseDuration;
    // Honor Android's "Time to take action" preference. Screen reader users
    // dismiss explicitly so announcements and Undo never race a short timer.
    const recommended = Platform.OS === "android"
      ? AccessibilityInfo.getRecommendedTimeoutMillis(baseDuration)
      : Promise.resolve(baseDuration);
    void recommended.catch(() => baseDuration).then((value) => {
      if (!active) return;
      duration.current = Math.max(baseDuration, value);
      startTimer();
    });
    return () => { active = false; clearTimer(); };
  }, [clearTimer, notice, startTimer]);

  React.useEffect(() => {
    if (notice && Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(notice.message);
    }
  }, [notice]);

  React.useEffect(() => {
    if (notice) {
      setDisplayed(notice);
      setFocused(null);
      direction.current = 0;
      drag.setValue(0);
      progress.setValue(0);
    }
    const animation = Animated.parallel([
      Animated.timing(progress, {
        toValue: notice ? 1 : 0,
        duration: reducedMotion ? 0 : notice ? appMotion.stateMs : appMotion.pressMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      ...(!notice ? [Animated.timing(drag, {
        toValue: reducedMotion ? 0 : direction.current * width,
        duration: reducedMotion ? 0 : appMotion.pressMs,
        useNativeDriver: true,
      })] : []),
    ]);
    animation.start(({ finished }) => {
      if (finished && !notice) setDisplayed(null);
    });
    return () => animation.stop();
  }, [drag, notice, progress, reducedMotion, width]);

  const resetDrag = React.useCallback(() => {
    Animated.timing(drag, {
      toValue: 0,
      duration: reducedMotion ? 0 : appMotion.pressMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    startTimer();
  }, [drag, reducedMotion, startTimer]);

  const pan = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: clearTimer,
    onPanResponderMove: (_, gesture) => drag.setValue(gesture.dx),
    onPanResponderRelease: (_, gesture) => {
      const target = current.current;
      if (target && (Math.abs(gesture.dx) > SWIPE_THRESHOLD || Math.abs(gesture.vx) > 0.75)) {
        dismiss(target, gesture.dx < 0 ? -1 : 1);
      } else resetDrag();
    },
    onPanResponderTerminate: resetDrag,
    onPanResponderTerminationRequest: () => true,
  }), [clearTimer, dismiss, drag, resetDrag]);

  if (!displayed) return null;
  const closing = displayed !== notice;
  const hasAction = Boolean(displayed.actionLabel && displayed.onAction);

  return (
    <View pointerEvents="box-none" style={styles.position}>
      <Animated.View
        {...pan.panHandlers}
        pointerEvents={closing ? "none" : "auto"}
        onTouchStart={clearTimer}
        onTouchEnd={startTimer}
        onAccessibilityEscape={() => dismiss(displayed)}
        style={[styles.surface, {
          opacity: Animated.multiply(progress, drag.interpolate({
            inputRange: [-width / 2, 0, width / 2],
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          })),
          transform: [
            { translateX: drag },
            { translateY: reducedMotion ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        }]}
      >
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.status}>
          {displayed.pending
            ? <ActivityIndicator size="small" color={appColors.textInverse} />
            : <CheckIcon size={20} color={appColors.success500} weight="bold" />}
        </View>
        <AppText accessibilityLiveRegion="polite" variant="bodySmallStrong" style={styles.message}>
          {displayed.message}
        </AppText>
        {hasAction ? (
          <AppButton
            label={displayed.actionLabel!}
            variant="ghost"
            size="sm"
            disabled={closing}
            onFocus={() => setFocused("action")}
            onBlur={() => setFocused(null)}
            style={[styles.action, focused === "action" && styles.focused]}
            textStyle={styles.actionText}
            onPress={() => { dismiss(displayed); displayed.onAction?.(); }}
          />
        ) : null}
        <IconButton
          accessibilityLabel="Dismiss notification"
          disabled={closing}
          onPress={() => dismiss(displayed)}
          onFocus={() => setFocused("close")}
          onBlur={() => setFocused(null)}
          style={[styles.close, focused === "close" && styles.focused]}
        >
          <XIcon size={18} color={appColors.textInverse} />
        </IconButton>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  position: {
    position: "absolute",
    bottom: appSpacing.sm,
    left: appSpacing.gutter,
    right: appSpacing.gutter,
    alignItems: "center",
    zIndex: 10,
  },
  surface: {
    width: "100%",
    maxWidth: 560,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
    paddingLeft: appSpacing.sm,
    paddingRight: appSpacing.xxs,
    paddingVertical: appSpacing.xxs,
    borderRadius: appRadius.lg,
    backgroundColor: appColors.surfaceInverse,
    shadowColor: appColors.textPrimary,
    shadowOpacity: 0.12,
    shadowRadius: appSpacing.sm,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  status: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    flexShrink: 1,
    color: appColors.textInverse,
    paddingVertical: appSpacing.xs,
  },
  action: {
    paddingHorizontal: appSpacing.xs,
    borderWidth: 1,
    borderColor: "transparent",
  },
  actionText: { color: appColors.actionPrimarySoft },
  close: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderRadius: appRadius.md,
  },
  focused: { borderColor: appColors.textInverse },
});
