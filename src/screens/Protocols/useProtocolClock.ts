import React from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { protocolDate } from "./protocolForm";

/** Presentation only: no alarms, recurrence or background work. */
export function useProtocolClock() {
  const [now, setNow] = React.useState(() => new Date());
  useFocusEffect(React.useCallback(() => {
    const update = () => setNow(new Date());
    update();
    const interval = setInterval(update, 30_000);
    const foreground = AppState.addEventListener("change", (state) => { if (state === "active") update(); });
    return () => { clearInterval(interval); foreground.remove(); };
  }, []));
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return { now, timezone, today: protocolDate(now, timezone) };
}

/** Refresh a visible next-dose projection when its instant passes. A skewed
 * device clock cannot create a tight request loop; normal focus/events retry.
 */
export function useProtocolNextRefresh(at: string | null | undefined, now: Date, reload: () => Promise<void>) {
  const lastAttempt = React.useRef(0);
  const instant = now.getTime();
  React.useEffect(() => {
    if (!at || Date.parse(at) > instant || instant - lastAttempt.current < 30_000) return;
    lastAttempt.current = instant;
    void reload();
  }, [at, instant, reload]);
}
