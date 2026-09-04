import AsyncStorage from "@react-native-async-storage/async-storage";

// Device key/value storage for the small amount of state that is genuinely
// local: whether onboarding finished, the draft profile collected before an
// account exists, and display preferences.
//
// This is deliberately not a database. Application data — foods, diary entries,
// weights, recipes, settings — lives in Supabase PostgreSQL and is reached only
// through the Nouri API. Nothing here is a copy of anything on the server, so
// there is nothing here that can disagree with it.
//
// Reads and writes are best-effort. A device whose storage is unavailable falls
// back to defaults rather than failing to start.

export const readKv = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeKv = async (key: string, value: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Best effort: the in-memory state still reflects the user's choice for
    // this session.
  }
};

export const removeKv = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // As above.
  }
};

export const readJsonKv = async <T>(key: string): Promise<T | null> => {
  const raw = await readKv(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const writeJsonKv = async (key: string, value: unknown): Promise<void> =>
  writeKv(key, JSON.stringify(value));
