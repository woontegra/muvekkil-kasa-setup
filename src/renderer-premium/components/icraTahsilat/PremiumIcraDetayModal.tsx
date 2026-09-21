import { useCallback, useEffect, useMemo, useState } from "react";
import type { IcraTahsilatListeSatir, IcraTahsilatTaksit } from "@shared/types/icraTahsilat";
import { formatDateTr, formatTry } from "../../lib/format";
import {
  icraAlacakDurumEtiket,
  icraAlacakDurumTone,
  icraAlacakTuruEtiket,
  icraTaksitDurumEtiket,
  icraTaksitDurumTone,
  icraTaksitSmmHucre,
} from "../../lib/icraTahsilat";
import { PremiumConfirmDialog } from "../dosya/PremiumConfirmDialog";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";
import { StatusBadge } from "../StatusBadge";
import { PremiumIcraTaksitDuzenleModal } from "./PremiumIcraTaksitDuzenleModal";
import { PremiumIcraTaksitGecmisModal } from "./PremiumIcraTaksitGecmisModal";
import { PremiumIcraTaksitOdemeModal } from "./PremiumIcraTaksitOdemeModal";

type Props = {
  open: boolean;
  alacak: IcraTahsilatListeSatir | null;
  onClose: () => void;
  onChanged: () => void;
  showToast: (tone: "success" | "error" | "warning" | "info", message: string) => void;
};

export function PremiumIcraDetayModal({ open, alacak, onClose, onChanged, showToast }: Props) {
  const [taksitler, setTaksitler] = useState<IcraTahsilatTaksit[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [odemeTaksit, setOdemeTaksit] = useState<IcraTahsilatTaksit | null>(null);
  const [gecmisTaksit, setGecmisTaksit] = useState<IcraTahsilatTaksit | null>(null);
  const [duzenleTaksit, setDuzenleTaksit] = useState<IcraTahsilatTaksit | null>(null);
  const [smmBusy, setSmmBusy] = useState(false);
  const [silTaksitId, setSilTaksitId] = useState<number | null>(null);
  const [silBusy, setSilBusy] = useState(false);

  const yukle = useCallback(async () => {
    if (!alacak) return;
    setYukleniyor(true);
    try {
      const rows = await window.api.icraTahsilatTaksitList(alacak.id);
      setTaksitler(Array.isArray(rows) ? rows : []);
    } catch {
      setTaksitler([]);
      showToast("error", "Taksit listesi yüklenemedi.");
    } finally {
      setYukleniyor(false);
    }
  }, [alacak, showToast]);

  useEffect(() => {
    if (open && alacak) {
      void yukle();
      setOdemeTaksit(null);
      setGecmisTaksit(null);
      setDuzenleTaksit(null);
    }
  }, [open, alacak, yukle]);

  const ozet = useMemo(() => {
    if (!alacak) return { taksitToplam: 0, beklenenTaksit: 0, fark: 0, eslesiyor: true };
    const taksitToplam = taksitler.reduce((s, t) => s + t.tutar, 0);
    const beklenenTaksit = Math.max(0, alacak.toplamTutar - alacak.pesinatTutar);
    const fark = Math.round((beklenenTaksit - taksitToplam) * 100) / 100;
    return { taksitToplam, beklenenTaksit, fark, eslesiyor: Math.abs(fark) <= 0.001 };
  }, [alacak, taksitler]);

  function yenile() {
    onChanged();
    void yukle();
  }

  async function smmKes(odemeId: number) {
    if (smmBusy) return;
    setSmmBusy(true);
    try {
      const res = await window.api.icraTahsilatSmmKesildi(odemeId);
      if (!res.ok) {
        showToast("error", res.error ?? "SMM güncellenemedi");
        return;
      }
      showToast("success", "SMM kesildi olarak işaretlendi.");
      yenile();
    } finally {
      setSmmBusy(false);
    }
  }

  async function taksitSilOnayla() {
    if (silTaksitId == null || silBusy) return;
    setSilBusy(true);
    try {
      const res = await window.api.icraTahsilatTaksitSil(silTaksitId);
      if (!res.ok) {
        showToast("error", res.error ?? "Silinemedi");
        return;
      }
      setSilTaksitId(null);
      showToast("success", "Taksit silindi.");
      yenile();
    } finally {
      setSilBusy(false);
    }
  }

  async function odemeKaydedildi() {
    showToast("success", "İcra tahsilat ödemesi kaydedildi.");
    yenile();
  }

  function duzenleKaydedildi() {
    showToast("success", "İcra tahsilat taksiti güncellendi.");
    yenile();
  }

  return (
    <>
      <PremiumModal
        open={open && alacak != null}
        title={alacak?.borcluAdi ?? "Alacak detayı"}
        wide
        onClose={onClose}
      >
        {alacak ? (
          <div className="pm-icra-detay">
            <p className="pm-icra-detay-tur">{icraAlacakTuruEtiket(alacak.alacakTuru)}</p>
            <div className="pm-icra-detay-ozet pm-stagger">
              <div className="pm-icra-detay-ozet-item pm-stagger-item">
                <span className="lbl">Toplam alacak</span>
                <strong>{formatTry(alacak.toplamTutar)}</strong>
              </div>
              <div className="pm-icra-detay-ozet-item pm-stagger-item">
                <span className="lbl">Peşinat</span>
                <strong>{formatTry(alacak.pesinatTutar)}</strong>
              </div>
              <div className="pm-icra-detay-ozet-item pm-stagger-item">
                <span className="lbl">Taksit toplamı</span>
                <strong>{formatTry(ozet.taksitToplam)}</strong>
              </div>
              <div className="pm-icra-detay-ozet-item pm-stagger-item">
                <span className="lbl">Tahsil edilen</span>
                <strong className="pm-icra-tahsil">{formatTry(alacak.odenenToplam)}</strong>
              </div>
              <div className="pm-icra-detay-ozet-item pm-stagger-item">
                <span className="lbl">Kalan</span>
                <strong>{formatTry(alacak.kalanTutar)}</strong>
              </div>
              <div className="pm-icra-detay-ozet-item pm-stagger-item">
                <span className="lbl">Dağıtılmamış fark</span>
                <strong className={!ozet.eslesiyor ? "pm-icra-warn" : undefined}>{formatTry(ozet.fark)}</strong>
              </div>
              <div className="pm-icra-detay-ozet-item pm-stagger-item">
                <span className="lbl">Durum</span>
                <StatusBadge tone={icraAlacakDurumTone(alacak.durum)}>{icraAlacakDurumEtiket(alacak.durum)}</StatusBadge>
              </div>
            </div>

            {!ozet.eslesiyor ? (
              <p className="pm-icra-detay-uyari" role="status">
                Taksit toplamı alacak tutarıyla eşleşmiyor.
              </p>
            ) : null}

            <div className="pm-icra-taksit-table-wrap">
              {yukleniyor ? (
                <div className="pm-icra-table-skeleton" aria-hidden />
              ) : taksitler.length === 0 ? (
                <p className="pm-muted">Taksit kaydı yok.</p>
              ) : (
                <table className="pm-icra-taksit-table">
                  <thead>
                    <tr>
                      <th>Taksit</th>
                      <th>Vade</th>
                      <th className="num">Tutar</th>
                      <th className="num">Ödenen</th>
                      <th className="num">Kalan</th>
                      <th>Durum</th>
                      <th>Son ödeme</th>
                      <th>SMM</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taksitler.map((t) => {
                      const smm = icraTaksitSmmHucre(t.smmDurumu);
                      const aktif =
                        odemeTaksit?.id === t.id || gecmisTaksit?.id === t.id || duzenleTaksit?.id === t.id;
                      return (
                        <tr key={t.id} className={[aktif ? "pm-icra-taksit-row--aktif" : "", "pm-icra-row-enter"].filter(Boolean).join(" ")}>
                          <td>{t.taksitNo}</td>
                          <td>{formatDateTr(t.vadeTarihi)}</td>
                          <td className="num">{formatTry(t.tutar)}</td>
                          <td className="num">{formatTry(t.odenenToplam)}</td>
                          <td className="num">{formatTry(t.kalanTutar)}</td>
                          <td>
                            <StatusBadge tone={icraTaksitDurumTone(t.durum)}>{icraTaksitDurumEtiket(t.durum)}</StatusBadge>
                          </td>
                          <td>{formatDateTr(t.sonOdemeTarihi)}</td>
                          <td>
                            <div className="pm-icra-smm-cell">
                              {smm.tone !== "default" ? (
                                <StatusBadge tone={smm.tone}>{smm.label}</StatusBadge>
                              ) : (
                                "—"
                              )}
                              {t.smmDurumu === "BEKLIYOR" && t.smmBekleyenOdemeId != null ? (
                                <button
                                  type="button"
                                  className="pm-icra-action pm-icra-action--warning"
                                  disabled={smmBusy}
                                  title="SMM Kesildi"
                                  onClick={() => void smmKes(t.smmBekleyenOdemeId!)}
                                >
                                  SMM
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div className="pm-icra-actions">
                              {t.kalanTutar > 0.001 ? (
                                <button
                                  type="button"
                                  className="pm-icra-action pm-icra-action--primary"
                                  title="Ödeme al"
                                  onClick={() => setOdemeTaksit(t)}
                                >
                                  ₺
                                </button>
                              ) : null}
                              <button type="button" className="pm-icra-action" title="Ödeme geçmişi" onClick={() => setGecmisTaksit(t)}>
                                ⏱
                              </button>
                              <button type="button" className="pm-icra-action" title="Düzenle" onClick={() => setDuzenleTaksit(t)}>
                                ✎
                              </button>
                              {t.odenenToplam <= 0.001 ? (
                                <button
                                  type="button"
                                  className="pm-icra-action pm-icra-action--danger"
                                  title="Sil"
                                  onClick={() => setSilTaksitId(t.id)}
                                >
                                  🗑
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}
      </PremiumModal>

      <PremiumIcraTaksitOdemeModal
        open={odemeTaksit != null}
        taksit={odemeTaksit}
        onClose={() => setOdemeTaksit(null)}
        onSaved={odemeKaydedildi}
        onError={(msg) => showToast("error", msg)}
      />

      <PremiumIcraTaksitGecmisModal
        open={gecmisTaksit != null}
        taksit={gecmisTaksit}
        smmBusy={smmBusy}
        onClose={() => setGecmisTaksit(null)}
        onSmmKes={smmKes}
        onError={(msg) => showToast("error", msg)}
      />

      <PremiumIcraTaksitDuzenleModal
        open={duzenleTaksit != null}
        taksit={duzenleTaksit}
        onClose={() => setDuzenleTaksit(null)}
        onSaved={duzenleKaydedildi}
        onError={(msg) => showToast("error", msg)}
      />

      <PremiumConfirmDialog
        open={silTaksitId != null}
        title="Taksiti sil"
        message="Bu taksiti silmek istediğinize emin misiniz?"
        variant="danger"
        confirmLabel="Sil"
        busy={silBusy}
        onConfirm={() => void taksitSilOnayla()}
        onCancel={() => {
          if (!silBusy) setSilTaksitId(null);
        }}
      />
    </>
  );
}
