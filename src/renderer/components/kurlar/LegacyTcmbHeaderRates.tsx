import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatDateTimeTr,
  formatDateTrShort,
  formatTcmbRateDisplay,
  istanbulTodayYmd,
  type TcmbRatesResponseDto,
  type TcmbRatesUiDto,
} from "@shared/lib/tcmbFormat";

function RateChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="desk-tcmb-chip">
      {label} <strong>{value}</strong>
    </span>
  );
}

/** SaaS `TcmbHeaderRates` — Legacy AppShell. */
export function LegacyTcmbHeaderRates() {
  const [data, setData] = useState<TcmbRatesResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);

  const load = useCallback(async (forceRefresh = false) => {
    if (!window.api?.kurlarTcmb) {
      setData({ ok: false, available: false, message: "Kur servisi yok" });
      setLoading(false);
      return;
    }
    try {
      const r = (await window.api.kurlarTcmb({
        date: istanbulTodayYmd(),
        forceRefresh,
      })) as TcmbRatesResponseDto;
      setData(r);
      if (r.available) setLastCheckedAt(r.lastCheckedAt ?? r.fetchedAt);
    } catch {
      setData({ ok: false, available: false, message: "Kur bilgisi alınamadı" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const refresh = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    void (async () => {
      try {
        const r = (await window.api.kurlarTcmb({
          date: istanbulTodayYmd(),
          forceRefresh: true,
        })) as TcmbRatesResponseDto;
        setData(r);
        if (r.available) {
          setLastCheckedAt(r.lastCheckedAt ?? r.fetchedAt);
          setStatusMsg(r.stale ? "Son bilinen kur gösteriliyor" : "TCMB kurları yenilendi");
        } else {
          setStatusMsg(r.message ?? "Kur bilgisi alınamadı");
        }
      } catch {
        setStatusMsg("Kur yenileme başarısız");
      } finally {
        inFlight.current = false;
        setRefreshing(false);
        window.setTimeout(() => setStatusMsg(null), 2500);
      }
    })();
  }, []);

  const snap = data?.available ? data : null;
  const tip = lastCheckedAt
    ? `TCMB kurlarını yenile · Son kontrol: ${formatDateTimeTr(lastCheckedAt)}`
    : "TCMB kurlarını yenile";

  return (
    <div className="desk-tcmb-header" ref={rootRef} data-testid="desk-tcmb-header">
      <button
        type="button"
        className="desk-tcmb-refresh"
        title={tip}
        aria-label="TCMB kurlarını yenile"
        disabled={refreshing}
        onClick={(e) => {
          e.stopPropagation();
          refresh();
        }}
      >
        ↻
      </button>
      {loading && !snap ? (
        <span className="desk-tcmb-muted">Kurlar yükleniyor…</span>
      ) : !snap ? (
        <span className="desk-tcmb-muted">Kur bilgisi alınamadı</span>
      ) : (
        <button
          type="button"
          className="desk-tcmb-trigger"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="desk-tcmb-rates">
            <RateChip label="USD/TRY" value={formatTcmbRateDisplay(snap.usdDovizAlis)} />
            <RateChip label="EUR/TRY" value={formatTcmbRateDisplay(snap.eurDovizAlis)} />
          </span>
          <span className="desk-tcmb-source">TCMB Döviz Alış · {formatDateTrShort(snap.effectiveDate)}</span>
        </button>
      )}
      {statusMsg ? <span className="desk-tcmb-status">{statusMsg}</span> : null}
      {open && snap ? (
        <div className="desk-tcmb-popover" role="dialog" aria-label="TCMB referans kurları">
          <p>
            USD Alış: <strong>{formatTcmbRateDisplay(snap.usdDovizAlis)}</strong> · Satış:{" "}
            <strong>{formatTcmbRateDisplay(snap.usdDovizSatis)}</strong>
          </p>
          <p>
            EUR Alış: <strong>{formatTcmbRateDisplay(snap.eurDovizAlis)}</strong> · Satış:{" "}
            <strong>{formatTcmbRateDisplay(snap.eurDovizSatis)}</strong>
          </p>
          <p className="desk-tcmb-muted">
            Kur tarihi: {formatDateTrShort(snap.effectiveDate)} · {(snap as TcmbRatesUiDto).sourceLabel}
          </p>
        </div>
      ) : null}
    </div>
  );
}
