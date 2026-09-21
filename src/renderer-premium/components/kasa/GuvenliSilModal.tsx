import { useEffect, useState } from "react";
import type { GuvenliSilInput } from "@shared/types/guvenliSil";
import {
  dosyaKasaGuvenliSilModalTitle,
  ofisGuvenliSilModalTitle,
  type DosyaKasaGuvenliSilMode,
  type OfisGuvenliSilMode,
} from "@shared/lib/guvenliSil";
import { formatDateTr, formatTry } from "../../lib/format";
import { formatMoney } from "@shared/lib/paraBirimi";
import { odemeEtiket } from "../../lib/kasa";
import { PremiumModal } from "../modal/PremiumModal";

export type GuvenliSilModalOzet = {
  id: number;
  tarih: string;
  aciklama: string;
  tutar: number;
  odemeYontemi?: string;
  belgeNo?: string | null;
  mode: DosyaKasaGuvenliSilMode | OfisGuvenliSilMode;
  muvekkilAdi?: string | null;
  kategori?: string | null;
  paraBirimi?: string;
};

type Props = {
  ozet: GuvenliSilModalOzet | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: GuvenliSilInput) => void;
};

function titleFor(mode: DosyaKasaGuvenliSilMode | OfisGuvenliSilMode): string {
  if (mode === "GIDER_SIL" || mode === "GELIR_SIL") return ofisGuvenliSilModalTitle(mode);
  return dosyaKasaGuvenliSilModalTitle(mode);
}

function blurbFor(mode: DosyaKasaGuvenliSilMode | OfisGuvenliSilMode): string {
  if (mode === "GELIR_SIL") {
    return "Bu gelir listeden ve mali toplamlardan çıkarılacak; güvenlik ve denetim geçmişi korunacaktır.";
  }
  if (mode === "AVANS_SIL") {
    return "Bu avans listeden ve mali toplamlardan çıkarılacak; güvenlik ve denetim geçmişi korunacaktır.";
  }
  return "Bu kayıt listeden ve mali toplamlardan çıkarılacak; güvenlik ve denetim geçmişi korunacaktır.";
}

export function GuvenliSilModal({ ozet, loading, error, onClose, onSubmit }: Props) {
  const [silmeNedeni, setSilmeNedeni] = useState("");
  const [sifre, setSifre] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    setSilmeNedeni("");
    setSifre("");
    setLocalErr(null);
  }, [ozet?.id, ozet?.mode]);

  if (!ozet) return null;

  const mode = ozet.mode;
  const showGelirFields = mode === "GELIR_SIL";
  const pb = ozet.paraBirimi ?? "TRY";
  const tutarLabel =
    mode === "GIDER_SIL" || mode === "GELIR_SIL"
      ? formatMoney(ozet.tutar, pb as "TRY" | "USD" | "EUR")
      : formatTry(ozet.tutar);

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
    <PremiumModal
      open
      title={titleFor(mode)}
      onClose={onClose}
      disabled={loading}
      footer={
        <div className="pm-modal-footer-actions">
          <button type="button" className="pm-btn pm-btn--ghost" onClick={onClose} disabled={loading}>
            Vazgeç
          </button>
          <button type="button" className="pm-btn pm-btn--danger" onClick={submit} disabled={loading}>
            {loading ? "İşleniyor…" : titleFor(mode)}
          </button>
        </div>
      }
    >
      <div className="pm-guvenli-sil">
        <p className="pm-muted pm-guvenli-sil-blurb">{blurbFor(mode)}</p>
        <dl className="pm-guvenli-sil-ozet">
          <div>
            <dt>Tarih</dt>
            <dd>{formatDateTr(ozet.tarih)}</dd>
          </div>
          {showGelirFields ? (
            <>
              <div>
                <dt>Müvekkil</dt>
                <dd>{ozet.muvekkilAdi?.trim() || "—"}</dd>
              </div>
              <div>
                <dt>Kategori</dt>
                <dd>{ozet.kategori?.trim() || "—"}</dd>
              </div>
            </>
          ) : null}
          <div>
            <dt>Açıklama</dt>
            <dd>{ozet.aciklama || "—"}</dd>
          </div>
          <div>
            <dt>Tutar</dt>
            <dd className="pm-num">{tutarLabel}</dd>
          </div>
          {ozet.odemeYontemi ? (
            <div>
              <dt>Ödeme yöntemi</dt>
              <dd>{odemeEtiket(ozet.odemeYontemi)}</dd>
            </div>
          ) : null}
          {ozet.belgeNo ? (
            <div>
              <dt>Belge no</dt>
              <dd>{ozet.belgeNo}</dd>
            </div>
          ) : null}
        </dl>
        <label className="pm-field">
          <span className="pm-field-label">Silme nedeni *</span>
          <textarea
            className="pm-input"
            rows={3}
            value={silmeNedeni}
            onChange={(e) => setSilmeNedeni(e.target.value)}
            autoComplete="off"
            placeholder="Nedeni yazın"
          />
        </label>
        <label className="pm-field">
          <span className="pm-field-label">Güvenlik için mevcut giriş şifrenizi yeniden girin *</span>
          <input
            className="pm-input"
            type="password"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            autoComplete="off"
            name="guvenli-sil-sifre-confirm"
            data-lpignore="true"
            data-1p-ignore="true"
          />
        </label>
        {localErr || error ? <p className="pm-form-error">{localErr ?? error}</p> : null}
      </div>
    </PremiumModal>
  );
}
