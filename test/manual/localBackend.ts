export type LocalSession = { access_token: string; refresh_token: string; user: { id: string } };

export const requireLocalBackend = () => {
  if (process.env.NOURI_DISPOSABLE_DB !== "1") throw new Error("Use the isolated local mobile test runner.");
  for (const value of [process.env.EXPO_PUBLIC_API_BASE_URL, process.env.EXPO_PUBLIC_SUPABASE_URL]) {
    const url = new URL(value ?? "");
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !["http:", "https:"].includes(url.protocol)) {
      throw new Error("Mobile integration checks require explicit loopback services.");
    }
  }
};

export const localAuth = async (path: string, body: unknown): Promise<LocalSession> => {
  requireLocalBackend();
  const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1${path}`, {
    method: "POST", headers: { "content-type": "application/json", apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Local Auth request failed (${response.status}).`);
  const session = await response.json() as LocalSession;
  if (!session.access_token || !session.refresh_token || !session.user?.id) throw new Error("Local Auth returned no session.");
  return session;
};
