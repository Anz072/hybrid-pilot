import React from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getAuthSessionGeneration, SessionChangedError } from "../../API/supabase/sessionScope";
import { NouriApiError } from "../../API/nouri/client";
import { ProtocolReadSupersededError } from "../../store/protocolsStore";
import { subscribeToAppDataChanges } from "../../store/dataChangeEvents";

export const protocolErrorMessage = (error: unknown): string => {
  if (error instanceof SessionChangedError) return error.message;
  if (error instanceof NouriApiError) {
    if (error.code === "CONFLICT") return "This record changed elsewhere. Reload it before saving again.";
    if (error.isNotFound) return "This record is no longer available for your account.";
    if (error.code === "NETWORK_ERROR" || error.code === "SERVICE_UNAVAILABLE") return "Could not reach Nouri. Your entered values are still here; check your connection and try again.";
    if (error.code === "RATE_LIMITED") return "Please wait a moment before trying again.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Could not complete this request. Please try again.";
};

/** Feature-local mounted state; no settled global cache or persistence. */
export function useProtocolRead<T>(userId: string, key: string, load: () => Promise<T>, includesMetrics = false) {
  const identity = `${userId}:${key}`;
  const loader = React.useRef(load); loader.current = load;
  const active = React.useRef(false);
  const sequence = React.useRef(0);
  const [state, setState] = React.useState<{ identity: string; data?: T; loading: boolean; error: string | null }>({ identity, loading: true, error: null });
  const reload = React.useCallback(async () => {
    const request = ++sequence.current;
    const session = getAuthSessionGeneration();
    const current = () => active.current && sequence.current === request && session === getAuthSessionGeneration();
    setState((old) => ({ identity, data: old.identity === identity ? old.data : undefined, loading: true, error: null }));
    // A mutation may supersede a read. Retry that read once, using the store's
    // new generation; never retry a write or loop indefinitely under changes.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const data = await loader.current();
        if (current()) setState({ identity, data, loading: false, error: null });
        return;
      } catch (error) {
        if (!current()) return;
        if (error instanceof ProtocolReadSupersededError && attempt === 0) continue;
        setState((old) => ({ ...old, loading: false, error: protocolErrorMessage(error) }));
        return;
      }
    }
  }, [identity]);
  useFocusEffect(React.useCallback(() => {
    active.current = true;
    void reload();
    const events = subscribeToAppDataChanges((event) => {
      if (event.userExternalId && event.userExternalId !== userId) return;
      if (event.kind === "protocols" || event.kind === "bloodwork" || event.kind === "settings"
        || (includesMetrics && (event.kind === "food_log" || event.kind === "weight"))) void reload();
    });
    const foreground = AppState.addEventListener("change", (next) => { if (next === "active") void reload(); });
    return () => { active.current = false; sequence.current += 1; events(); foreground.remove(); };
  }, [reload, userId, includesMetrics]));
  return { ...(state.identity === identity ? state : { data: undefined, loading: true, error: null }), reload };
}
