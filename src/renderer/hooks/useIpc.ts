import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for invoking IPC calls to the main process.
 * Returns [data, loading, error, refetch].
 */
export function useIpcQuery<T>(channel: string, ...args: unknown[]): [T | null, boolean, Error | null, () => void] {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    setError(null);
    window.api.invoke(channel, ...args)
      .then((result) => {
        setData(result as T);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, JSON.stringify(args)]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return [data, loading, error, fetch];
}

/**
 * Hook for IPC mutations (actions that modify state).
 * Returns [invoke, loading, error].
 */
export function useIpcMutation<T = unknown>(channel: string): [
  (...args: unknown[]) => Promise<T>,
  boolean,
  Error | null,
] {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const invoke = useCallback(async (...args: unknown[]): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.invoke(channel, ...args);
      setLoading(false);
      return result as T;
    } catch (err) {
      setError(err as Error);
      setLoading(false);
      throw err;
    }
  }, [channel]);

  return [invoke, loading, error];
}

/**
 * Hook for subscribing to IPC events from main process.
 * Uses a ref to always call the latest callback without re-subscribing.
 */
export function useIpcEvent<T = unknown>(channel: string, callback: (data: T) => void): void {
  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; });

  useEffect(() => {
    const unsubscribe = window.api.on(channel, (data) => {
      callbackRef.current(data as T);
    });
    return unsubscribe;
  }, [channel]);
}
