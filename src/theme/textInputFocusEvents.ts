const listeners = new Set<() => void>();

export const notifyTextInputFocused = () => {
  listeners.forEach((listener) => listener());
};

export const subscribeToTextInputFocus = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};
