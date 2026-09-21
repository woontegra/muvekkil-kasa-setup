import { useEffect, useState } from "react";
import type { GuvenliSilInput } from "@shared/types/guvenliSil";
import {
  dosyaKasaGuvenliSilModalTitle,
  ofisGuvenliSilModalTitle,
  type DosyaKasaGuvenliSilMode,
  type OfisGuvenliSilMode,
} from "@shared/lib/guvenliSil";
import { formatDateTr, formatTry } from "../lib/format";
import { odemeEtiket } from "../lib/kasa";

export type DeskGuvenliSilOzet = {
  id: number;
  tarih: string;
  aciklama: string;
  tutar: number;
  odemeYontemi?: string;
  mode: DosyaKasaGuvenliSilMode | OfisGuvenliSilMode;
};

type Props = {
  ozet: DeskGuvenliSilOzet | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: GuvenliSilInput) => void;
};

function titleFor(mode: DosyaKasaGuvenliSilMode | OfisGuvenliSilMode): string {
  if (mode === "GIDER_SIL" || mode === "GELIR_SIL") return ofisGuvenliSilModalTitle(mode);
  return dosyaKasaGuvenliSilModalTitle(mode);
}

export function DeskGuvenliSilModal({ ozet, loading, error, onClose, onSubmit }: Props) {
  const [silmeNedeni, setSilmeNedeni] = useState("");
  const [sifre, setSifre] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    setSilmeNedeni("");
    setSifre("");
    setLocalErr(null);
  }, [ozet?.id, ozet?.mode]);

  if (!ozet) return null;

  function submit() {
    setLocalErr(null);
    if (silmeNedeni.trim().length < 3) {
      setLocalErr("Neden zorunludur (en az 3 karakter).");
      return;
    }
    if (!sifre) {
      setLocalErr("Güvenlik için mevcut giriş şifrenizi girin.");
      return;
    }
    onSubmit({ sifre, silmeNedeni: silmeNedeni.trim() });
  }

  return (
    <div className="desk-modal-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && !loading && onClose()}>
      <div className="desk-modal-panel desk-modal-panel--narrow" role="dialog" aria-modal="true">
        <header className="desk-modal-head">
          <h2>{titleFor(ozet.mode)}</h2>
          <button type="button" className="desk-modal-close" onClick={onClose} disabled={loading} aria-label="Kapat">
            ×
          </button>
        </header>
        <div className="desk-modal-body">
          <p className="desk-muted">Kayıt listeden çıkarılır; denetim geçmişi korunur.</p>
          <dl className="desk-dl-compact">
            <div>
              <dt>Tarih</dt>
              <dd>{formatDateTr(ozet.tarih)}</dd>
            </div>
            <div>
              <dt>Açıklama</dt>
              <dd>{ozet.aciklama || "—"}</dd>
            </div>
            <div>
              <dt>Tutar</dt>
              <dd>{formatTry(ozet.tutar)}</dd>
            </div>
            {ozet.odemeYontemi ? (
              <div>
                <dt>Ödeme</dt>
                <dd>{odemeEtiket(ozet.odemeYontemi)}</dd>
              </div>
            ) : null}
          </dl>
          <label className="desk-field">
            <span>Silme nedeni *</span>
            <textarea className="desk-input" rows={3} value={silmeNedeni} onChange={(e) => setSilmeNedeni(e.target.value)} />
          </label>
          <label className="desk-field">
            <span>Mevcut giriş şifreniz *</span>
            <input className="desk-input" type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} autoComplete="off" />
          </label>
          {localErr || error ? <p className="desk-form-error">{localErr ?? error}</p> : null}
        </div>
        <footer className="desk-modal-foot">
          <button type="button" className="desk-btn desk-btn--ghost" onClick={onClose} disabled={loading}>
            Vazgeç
          </button>
          <button type="button" className="desk-btn desk-btn--danger" onClick={submit} disabled={loading}>
            {loading ? "İşleniyor…" : titleFor(ozet.mode)}
          </button>
        </footer>
      </div>
    </div>
  );
}
