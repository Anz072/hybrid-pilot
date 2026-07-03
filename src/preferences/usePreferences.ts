import React from "react";
import {
  type DisplayPreferences,
  getDisplayPreferencesSnapshot,
  subscribeToDisplayPreferences,
} from "./displayPreferences";

// Subscribe a component to display preferences. Re-renders whenever the user
// changes units or time format so formatters pick up the new setting live.
export const useDisplayPreferences = (): DisplayPreferences => {
  return React.useSyncExternalStore(
    subscribeToDisplayPreferences,
    getDisplayPreferencesSnapshot,
    getDisplayPreferencesSnapshot,
  );
};
