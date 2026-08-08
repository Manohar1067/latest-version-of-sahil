import { useEffect, useState, useCallback } from "react";
import { subscribeTransport } from "./transportListStore";

/** Same contract as useStoreData, but bound to the transport_list store only. */
export function useTransportData<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(() => {
    setLoading(true);
    loader()
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    const unsub = subscribeTransport(() => run());
    return () => {
      unsub();
    };
  }, [run]);

  return { data, loading, refresh: run };
}
