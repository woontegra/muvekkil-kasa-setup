import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatDateTimeTr,
  formatDateTrShort,
  formatTcmbRateDisplay,
  istanbulTodayYmd,
  type TcmbRatesResponseDto,
  type TcmbRatesUiDto,
} from "@shared/lib/tcmbFormat";
import { usePremiumToast } from "../../context/PremiumToastContext";

function RateChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="pm-tcmb-chip">
      {label} <strong>{value}</strong>
    </span>
  );
}

function RefreshBtn(props: {
  refreshing: boolean;
  lastCheckedAt: string | null;
  onRefresh: () => void;
}) {
  const tip = props.lastCheckedAt
    ? `TCMB kurlarını yenile · Son kontrol: ${formatDateTimeTr(props.lastCheckedAt)}`
    : "TCMB kurlarını yenile";
  return (
    <button
      type="button"
      className="pm-tcmb-refresh"
      title={tip}
      aria-label="TCMB kurlarını yenile"
      disabled={props.refreshing}
      onClick={(e) => {
        e.stopPropagation();
        props.onRefresh();
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={props.refreshing ? "pm-tcmb-spin" : undefined}
        aria-hidden
      >
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}

function PopoverContent({ data, lastCheckedAt }: { data: TcmbRatesUiDto; lastCheckedAt: string | null }) {
  const checked = lastCheckedAt ?? data.lastCheckedAt ?? data.fetchedAt;
  return (
    <div className="pm-tcmb-popover" role="dialog" aria-label="TCMB referans kurları">
      {data.stale ? (
        <p className="pm-tcmb-warn">TCMB’ye şu anda ulaşılamadı; son yayımlanan kur gösteriliyor.</p>
      ) : data.fallbackKullanildi ? (
        <p className="pm-tcmb-note">TCMB’nin son yayımladığı kur gösteriliyor.</p>
      ) : null}
      <div className="pm-tcmb-pair">
        <p className="pm-tcmb-pair-title">USD/TRY</p>
        <p>Alış: <strong>{formatTcmbRateDisplay(data.usdDovizAlis)}</strong></p>
        <p>Satış: <strong>{formatTcmbRateDisplay(data.usdDovizSatis)}</strong></p>
      </div>
      <div className="pm-tcmb-pair">
        <p className="pm-tcmb-pair-title">EUR/TRY</p>
        <p>Alış: <strong>{formatTcmbRateDisplay(data.eurDovizAlis)}</strong></p>
        <p>Satış: <strong>{formatTcmbRateDisplay(data.eurDovizSatis)}</strong></p>
      </div>
      <dl className="pm-tcmb-meta">
        <div><dt>Kur tarihi</dt><dd>{formatDateTrShort(data.effectiveDate)}</dd></div>
        <div><dt>Son kontrol</dt><dd>{formatDateTimeTr(checked)}</dd></div>
        <div><dt>Kaynak</dt><dd>{data.sourceLabel}</dd></div>
      </dl>
      <p className="pm-tcmb-footnote">TCMB referans kuru — bilgilendirme amaçlıdır.</p>
    </div>
  );
}

/** SaaS `TcmbHeaderRates` Desktop Premium karşılığı — shell header. */
export function PremiumTcmbHeaderRates() {
  const { showToast } = usePremiumToast();
  const [data, setData] = useState<TcmbRatesResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
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
      if (r.available) {
        setLastCheckedAt(r.lastCheckedAt ?? r.fetchedAt);
      }
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
        const prev =
          data && data.available
            ? `${data.usdDovizAlis}|${data.eurDovizAlis}|${data.bulunanTcmbKurTarihi}`
            : null;
        const r = (await window.api.kurlarTcmb({
          date: istanbulTodayYmd(),
          forceRefresh: true,
        })) as TcmbRatesResponseDto;
        setData(r);
        if (r.available) {
          setLastCheckedAt(r.lastCheckedAt ?? r.fetchedAt);
          const next = `${r.usdDovizAlis}|${r.eurDovizAlis}|${r.bulunanTcmbKurTarihi}`;
          if (prev && prev === next && !r.stale) {
            showToast("success", "Kurlar güncel (değişiklik yok).");
          } else if (r.stale) {
            showToast("error", "TCMB’ye ulaşılamadı; son bilinen kur gösteriliyor.");
          } else {
            showToast("success", "TCMB kurları yenilendi.");
          }
        } else {
          showToast("error", r.message ?? "Kur bilgisi alınamadı.");
        }
      } catch {
        showToast("error", "Kur yenileme başarısız.");
      } finally {
        inFlight.current = false;
        setRefreshing(false);
      }
    })();
  }, [data, showToast]);

  const snap = data?.available ? data : null;

  if (loading && !snap) {
    return (
      <div className="pm-tcmb-header" data-testid="pm-tcmb-header">
        <RefreshBtn refreshing={refreshing} lastCheckedAt={lastCheckedAt} onRefresh={refresh} />
        <span className="pm-tcmb-muted">Kurlar yükleniyor…</span>
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="pm-tcmb-header" data-testid="pm-tcmb-header">
        <RefreshBtn refreshing={refreshing} lastCheckedAt={lastCheckedAt} onRefresh={refresh} />
        <span className="pm-tcmb-muted">Kur bilgisi alınamadı</span>
      </div>
    );
  }

  const usdLabel = formatTcmbRateDisplay(snap.usdDovizAlis);
  const eurLabel = formatTcmbRateDisplay(snap.eurDovizAlis);
  const dateLabel = formatDateTrShort(snap.effectiveDate);

  return (
    <div className="pm-tcmb-header" ref={rootRef} data-testid="pm-tcmb-header">
      <RefreshBtn refreshing={refreshing} lastCheckedAt={lastCheckedAt} onRefresh={refresh} />
      <button
        type="button"
        className="pm-tcmb-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        title={lastCheckedAt ? `Son kontrol: ${formatDateTimeTr(lastCheckedAt)}` : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="pm-tcmb-rates">
          <RateChip label="USD/TRY" value={usdLabel} />
          <RateChip label="EUR/TRY" value={eurLabel} />
        </span>
        <span className="pm-tcmb-source">
          TCMB Döviz Alış · {dateLabel}
        </span>
        {snap.stale ? <span className="pm-tcmb-stale">Son yayımlanan kur</span> : null}
      </button>
      {open ? <PopoverContent data={snap} lastCheckedAt={lastCheckedAt} /> : null}
    </div>
  );
}
