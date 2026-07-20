import React from "react";
import { AccessibilityInfo } from "react-native";

/** Tracks the OS-level "reduce motion" accessibility preference. */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled?.().then((value) => {
      if (active) {
        setReduced(Boolean(value));
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value: boolean) => setReduced(Boolean(value)),
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
};
