import React from "react";
import { getAuthSessionGeneration } from "../../API/supabase/sessionScope";
import { protocolErrorMessage } from "./useProtocolRead";

export function useProtocolMutation() {
  const mounted = React.useRef(true);
  const pending = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async <T,>(request: () => Promise<T>): Promise<T | undefined> => {
    if (pending.current) return undefined;
    pending.current = true; setBusy(true); setError(null);
    const session = getAuthSessionGeneration();
    try {
      const result = await request();
      return mounted.current && session === getAuthSessionGeneration() ? result : undefined;
    } catch (cause) {
      if (mounted.current && session === getAuthSessionGeneration()) setError(protocolErrorMessage(cause));
      return undefined;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return { run, busy, error, clearError: () => setError(null) };
}
