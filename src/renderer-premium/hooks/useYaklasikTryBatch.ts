import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney, type ParaBirimi } from "@shared/lib/paraBirimi";
import { formatDateTrShort } from "@shared/lib/tcmbFormat";

export type YaklasikItem = { id: string; tutar: number; paraBirimi: ParaBirimi };

export type YaklasikBatchResult = {
  available: boolean;
  kurBilgiSatiri: string | null;
  byId: Record<string, { gosterim: string | null; tryTutar: number | null }>;
};

export function yaklasikByKey(
  data: YaklasikBatchResult | null | undefined,
  key: string,
): { gosterim: string | null } {
  return { gosterim: data?.byId[key]?.gosterim ?? null };
}

/** SaaS useYaklasikTryBatch — Desktop IPC. */
export function useYaklasikTryBatch(
  paraBirimi: ParaBirimi | null | undefined,
  items: YaklasikItem[],
  enabled: boolean,
): { data: YaklasikBatchResult | null; isLoading: boolean; unavailable: boolean } {
  const [data, setData] = useState<YaklasikBatchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pb = paraBirimi ?? "TRY";
  const itemsKey = useMemo(
    () => items.map((i) => `${i.id}:${i.tutar}:${i.paraBirimi}`).join("|"),
    [items],
  );

  const load = useCallback(async () => {
    if (!enabled || pb === "TRY" || items.length === 0) {
      setData(null);
      return;
    }
    if (!window.api?.kurlarYaklasikTry) {
      setData({ available: false, kurBilgiSatiri: null, byId: {} });
      return;
    }
    setIsLoading(true);
    try {
      const rows = await window.api.kurlarYaklasikTry(items);
      const byId: YaklasikBatchResult["byId"] = {};
      let available = true;
      let kurTarihi: string | null = null;
      for (const r of rows) {
        const id = r.id ?? "";
        if (!id) continue;
        if (!r.available && r.paraBirimi !== "TRY") available = false;
        if (r.kurTarihi) kurTarihi = r.kurTarihi;
        byId[id] = {
          tryTutar: r.tryTutar,
          gosterim: r.tryTutar != null ? formatMoney(r.tryTutar, "TRY") : null,
        };
      }
      setData({
        available,
        kurBilgiSatiri: kurTarihi
          ? `Kur tarihi: ${formatDateTrShort(kurTarihi)} · TCMB Döviz Alış`
          : null,
        byId,
      });
    } catch {
      setData({ available: false, kurBilgiSatiri: null, byId: {} });
    } finally {
      setIsLoading(false);
    }
  }, [enabled, pb, itemsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- itemsKey proxies items

  useEffect(() => {
    void load();
  }, [load]);

  const unavailable =
    pb !== "TRY" && enabled && !isLoading && data != null && !data.available;

  return { data, isLoading, unavailable };
}
