export type AppDataChangeKind = "food_log" | "weight";

export type AppDataChangeEvent = {
  date?: string | null;
  kind: AppDataChangeKind;
  userExternalId?: string | null;
  /** A successfully saved entry to reveal when the diary next becomes visible. */
  foodEntryId?: number;
};

type AppDataChangeListener = (event: AppDataChangeEvent) => void;

const listeners = new Set<AppDataChangeListener>();

export const subscribeToAppDataChanges = (listener: AppDataChangeListener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const notifyAppDataChanged = (event: AppDataChangeEvent) => {
  listeners.forEach((listener) => {
    listener(event);
  });
};
