import { useEffect, useState, useCallback } from "react";
import { subscribe } from "./dataStore";

/**
 * Subscribes a component to data store changes.
 * Pass an async loader; component re-runs it whenever any store write happens.
 */
export function useStoreData<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(() => {
    setLoading(true);
    loader().then((d) => {
      setData(d);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    const unsub = subscribe(() => run());
    return () => {
      unsub();
    };
  }, [run]);

  return { data, loading, refresh: run };
}
