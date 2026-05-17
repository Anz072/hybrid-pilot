export type AppDataChangeKind = "food_log" | "weight";

export type AppDataChangeEvent = {
  date?: string | null;
  kind: AppDataChangeKind;
  userExternalId?: string | null;
};

type AppDataChangeListener = (event: AppDataChangeEvent) => void;

const listeners = new Set<AppDataChangeListener>();

export const subscribeToAppDataChanges = (
  listener: AppDataChangeListener,
) => {
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
