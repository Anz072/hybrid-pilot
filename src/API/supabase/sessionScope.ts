// Process-lifetime identity boundary. Token renewal for the same account keeps
// requests valid; sign-out or an account change invalidates even A → B → A.
// The singleton Supabase client's auth listener is the only event producer.
let userId: string | null | undefined;
let generation = 0;

export const observeAuthIdentity = (nextUserId: string | null, signedOut = false): void => {
  if (signedOut || (userId !== undefined && userId !== nextUserId)) generation += 1;
  userId = nextUserId;
};

export const getAuthSessionGeneration = (): number => generation;

export class SessionChangedError extends Error {
  constructor() {
    super("Your account changed. Reopen this screen before continuing.");
    this.name = "SessionChangedError";
  }
}

export const assertAuthSessionGeneration = (expected: number): void => {
  if (generation !== expected) throw new SessionChangedError();
};
