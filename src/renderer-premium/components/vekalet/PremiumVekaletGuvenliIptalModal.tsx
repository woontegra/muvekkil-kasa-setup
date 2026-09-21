import { useEffect, useMemo, useState } from "react";
import type { GuvenliSilInput } from "@shared/types/guvenliSil";
import type { VekaletTaksit, VekaletTaksitOdeme } from "@shared/types/vekalet";
import { formatDateTr } from "../../lib/format";
import { formatMoney } from "@shared/lib/paraBirimi";
import { odemeEtiket } from "../../lib/kasa";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";
import { StatusBadge } from "../StatusBadge";

const TAKSIT_IPTAL_UYARI =
  "Bu taksit iptal edilecek ancak anlaşılan vekalet ücreti değişmeyecektir. Kalan tutarı daha sonra yeniden taksitlendirebilirsiniz.";

function isAktifOdeme(o: VekaletTaksitOdeme): boolean {
  return o.makbuzDurumu !== "IPTAL" && !o.iptalTarihi;
}

type Props = {
  taksit: VekaletTaksit;
  odemeler: VekaletTaksitOdeme[];
  preselectedOdemeId?: number | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSilTaksit: (payload: GuvenliSilInput) => void;
  onSilTahsilat: (odemeId: number, payload: GuvenliSilInput) => void;
};

export function PremiumVekaletGuvenliIptalModal({
  taksit,
  odemeler,
  preselectedOdemeId,
  loading,
  error,
  onClose,
  onSilTaksit,
  onSilTahsilat,
}: Props) {
  const unpaid = taksit.odenenToplam <= 0.005;
  const aktif = useMemo(() => odemeler.filter(isAktifOdeme), [odemeler]);
  const [selected, setSelected] = useState<VekaletTaksitOdeme | null>(null);
  const [silmeNedeni, setSilmeNedeni] = useState("");
  const [sifre, setSifre] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    setSilmeNedeni("");
    setSifre("");
    setLocalErr(null);
    setSelected(null);
  }, [taksit.id, preselectedOdemeId]);

  useEffect(() => {
    if (unpaid) return;
    if (preselectedOdemeId) {
      const hit = aktif.find((o) => o.id === preselectedOdemeId);
      if (hit) {
        setSelected(hit);
        return;
      }
    }
    if (aktif.length === 1) setSelected(aktif[0]!);
  }, [unpaid, aktif, preselectedOdemeId]);

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
    const payload = { silmeNedeni: silmeNedeni.trim(), sifre };
    if (unpaid) {
      onSilTaksit(payload);
      return;
    }
    if (!selected) {
      setLocalErr("İptal edilecek tahsilat seçin.");
      return;
    }
    onSilTahsilat(selected.id, payload);
  }

  const title = unpaid ? "Taksiti güvenli iptal" : "Tahsilatı güvenli iptal";
  const err = localErr ?? error;

  return (
    <PremiumModal
      open
      title={title}
      onClose={onClose}
      disabled={loading}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Vazgeç
          </PremiumButton>
          <PremiumButton type="button" className="pm-btn--danger" onClick={submit} disabled={loading || (!unpaid && !selected)}>
            {loading ? "İşleniyor…" : "Güvenli iptal"}
          </PremiumButton>
        </>
      }
    >
      {err ? <p className="pm-form-error">{err}</p> : null}

      {unpaid ? (
        <>
          <p className="pm-form-hint">{TAKSIT_IPTAL_UYARI}</p>
          <dl className="pm-guvenli-sil-ozet">
            <div>
              <dt>Taksit</dt>
              <dd>
                #{taksit.taksitNo} · {formatMoney(taksit.tutar, taksit.paraBirimi)} · vade {formatDateTr(taksit.vadeTarihi)}
              </dd>
            </div>
          </dl>
        </>
      ) : aktif.length === 0 ? (
        <p className="pm-muted">Aktif tahsilat bulunamadı. Taksit satırı korunur.</p>
      ) : selected ? (
        <>
          <p className="pm-form-hint">
            Tahsilat iptal edilecek; bağlı ofis kasa geliri listeden çıkarılır. Makbuz numarası korunur.
          </p>
          <dl className="pm-guvenli-sil-ozet">
            <div>
              <dt>Taksit</dt>
              <dd>#{taksit.taksitNo}</dd>
            </div>
            <div>
              <dt>Tarih</dt>
              <dd>{formatDateTr(selected.odemeTarihi)}</dd>
            </div>
            <div>
              <dt>Tutar</dt>
              <dd>{formatMoney(selected.tutar, selected.alacakParaBirimi)}</dd>
            </div>
            <div>
              <dt>Ödeme yöntemi</dt>
              <dd>{odemeEtiket(selected.odemeYontemi)}</dd>
            </div>
            {selected.makbuzNo ? (
              <div>
                <dt>Makbuz no</dt>
                <dd>{selected.makbuzNo}</dd>
              </div>
            ) : null}
          </dl>
          {aktif.length > 1 ? (
            <PremiumButton type="button" variant="ghost" className="pm-btn--sm" onClick={() => setSelected(null)}>
              Başka tahsilat seç
            </PremiumButton>
          ) : null}
        </>
      ) : (
        <>
          <p className="pm-form-hint">Birden fazla aktif tahsilat var. İptal edilecek satırı seçin.</p>
          <ul className="pm-vekalet-guvenli-list">
            {aktif.map((o) => (
              <li key={o.id}>
                <button type="button" className="pm-vekalet-guvenli-pick" onClick={() => setSelected(o)}>
                  <span>{formatDateTr(o.odemeTarihi)}</span>
                  <span>{formatMoney(o.tutar, o.alacakParaBirimi)}</span>
                  <span>{odemeEtiket(o.odemeYontemi)}</span>
                  {o.makbuzNo ? <StatusBadge tone="default">{o.makbuzNo}</StatusBadge> : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {(unpaid || selected) && aktif.length >= 0 ? (
        <div className="pm-guvenli-sil-form">
          <label className="pm-field">
            <span className="pm-field-label">İptal nedeni</span>
            <textarea
              className="pm-input"
              rows={3}
              value={silmeNedeni}
              onChange={(e) => setSilmeNedeni(e.target.value)}
              placeholder="En az 3 karakter"
              disabled={loading}
            />
          </label>
          <label className="pm-field">
            <span className="pm-field-label">Büro sahibi şifresi</span>
            <input
              type="password"
              className="pm-input"
              value={sifre}
              onChange={(e) => setSifre(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </label>
        </div>
      ) : null}
    </PremiumModal>
  );
}
