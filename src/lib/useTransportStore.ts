import { useEffect, useState, useCallback } from "react";
import { subscribeTransport } from "./transportListStore";

/** Same contract as useStoreData, but bound to the transport_list store only. */
export function useTransportData<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; error: string | null; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    setLoading(true);
    loader()
      .then((d) => {
        setData(d);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        // Never swallow query failures — surface them to the page.
        console.error("[transport_list]", e);
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    const unsub = subscribeTransport(() => run());
    return () => {
      unsub();
    };
  }, [run]);

  return { data, loading, error, refresh: run };
}
