import { useEffect, useState, useCallback } from "react";
import { subscribe } from "./dataStore";

/**
 * Subscribes a component to data store changes.
 * Pass an async loader; component re-runs it whenever any store write happens.
 */
export function useStoreData<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; refresh: () => void; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    loader()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // A failed load must never leave the page stuck on "Loading…" forever.
        // Keep the last good data (if any) so the UI degrades gracefully.
        setError(e instanceof Error ? e.message : "Failed to load data");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const cancel = run();
    const unsub = subscribe(() => run());
    return () => {
      if (cancel) cancel();
      unsub();
    };
  }, [run]);

  return { data, loading, refresh: run, error };
}
