let pending: Promise<unknown> = Promise.resolve();

export function sandboxTransaction<T>(keys: string[], action: () => Promise<T>): Promise<T> {
  const result = pending.then(async () => {
    const snapshot = keys.map(key => [key, localStorage.getItem(key)] as const);
    try {
      return await action();
    } catch (error) {
      for (const [key, value] of snapshot) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
      throw error;
    }
  });
  pending = result.catch(() => undefined);
  return result;
}
