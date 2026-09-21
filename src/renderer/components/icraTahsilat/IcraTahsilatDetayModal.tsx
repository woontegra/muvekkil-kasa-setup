import { useCallback, useEffect, useMemo, useState } from "react";
import type { IcraTahsilatListeSatir, IcraTahsilatTaksit } from "@shared/types/icraTahsilat";
import { DeskModalPortal } from "../DeskModalPortal";
import { DeskModalBackdrop } from "../DeskModalBackdrop";
import { DeskTableIconBtn } from "../DeskTableIconBtn";
import {
  IconDuzenle,
  IconGecmis,
  IconLira,
  IconSil,
  IconSmm,
} from "../DeskTableIcons";
import { IcraTahsilatTaksitDuzenleModal } from "./IcraTahsilatTaksitDuzenleModal";
import { IcraTahsilatTaksitGecmisModal } from "./IcraTahsilatTaksitGecmisModal";
import { IcraTahsilatTaksitOdemeModal } from "./IcraTahsilatTaksitOdemeModal";
import { formatDateTr, formatTry } from "../../lib/format";
import {
  icraAlacakDurumBadgeClass,
  icraAlacakDurumEtiket,
  icraAlacakTuruEtiket,
  icraTaksitDurumBadgeClass,
  icraTaksitDurumEtiket,
  icraTaksitSmmHucre,
} from "../../lib/icraTahsilat";

type Props = {
  open: boolean;
  alacak: IcraTahsilatListeSatir | null;
  onClose: () => void;
  onChanged: () => void;
};

export function IcraTahsilatDetayModal({ open, alacak, onClose, onChanged }: Props) {
  const [taksitler, setTaksitler] = useState<IcraTahsilatTaksit[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [odemeTaksit, setOdemeTaksit] = useState<IcraTahsilatTaksit | null>(null);
  const [gecmisTaksit, setGecmisTaksit] = useState<IcraTahsilatTaksit | null>(null);
  const [duzenleTaksit, setDuzenleTaksit] = useState<IcraTahsilatTaksit | null>(null);

  const yukle = useCallback(async () => {
    if (!alacak) return;
    setYukleniyor(true);
    try {
      const rows = await window.api?.icraTahsilatTaksitList?.(alacak.id);
      setTaksitler(Array.isArray(rows) ? rows : []);
    } catch {
      setTaksitler([]);
    } finally {
      setYukleniyor(false);
    }
  }, [alacak]);

  useEffect(() => {
    if (open && alacak) {
      void yukle();
      setOdemeTaksit(null);
      setGecmisTaksit(null);
      setDuzenleTaksit(null);
    }
  }, [open, alacak, yukle]);

  const ozet = useMemo(() => {
    if (!alacak) {
      return { taksitToplam: 0, beklenenTaksit: 0, fark: 0, eslesiyor: true };
    }
    const taksitToplam = taksitler.reduce((s, t) => s + t.tutar, 0);
    const beklenenTaksit = Math.max(0, alacak.toplamTutar - alacak.pesinatTutar);
    const fark = Math.round((beklenenTaksit - taksitToplam) * 100) / 100;
    return {
      taksitToplam,
      beklenenTaksit,
      fark,
      eslesiyor: Math.abs(fark) <= 0.001,
    };
  }, [alacak, taksitler]);

  function yenile() {
    onChanged();
    void yukle();
  }

  async function smmKes(odemeId: number) {
    const res = await window.api?.icraTahsilatSmmKesildi?.(odemeId);
    if (!res?.ok) alert(res?.error ?? "SMM güncellenemedi");
    yenile();
  }

  async function taksitSil(id: number) {
    if (!confirm("Bu taksiti silmek istediğinize emin misiniz?")) return;
    const res = await window.api?.icraTahsilatTaksitSil?.(id);
    if (!res?.ok) alert(res?.error ?? "Silinemedi");
    yenile();
  }

  if (!open || !alacak) return null;

  function satirAktif(t: IcraTahsilatTaksit) {
    return odemeTaksit?.id === t.id || gecmisTaksit?.id === t.id || duzenleTaksit?.id === t.id;
  }

  return (
    <DeskModalPortal>
      <DeskModalBackdrop className="modal-backdrop desk-icra-detay-backdrop" onClose={onClose}>
        <div
          className="modal modal-desk modal-desk--icra-detay"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="icra-detay-title"
        >
          <div className="modal-header desk-icra-detay-header">
            <h2 id="icra-detay-title" className="desk-icra-detay-title">
              {alacak.borcluAdi}
              <span className="desk-icra-detay-subtitle">{icraAlacakTuruEtiket(alacak.alacakTuru)}</span>
            </h2>
            <button type="button" className="modal-close desk-icra-detay-close" onClick={onClose} aria-label="Kapat">
              ×
            </button>
          </div>

          <div className="modal-body desk-icra-detay-body">
            <div className="desk-icra-detay-ozet-grid">
              <div className="desk-icra-detay-ozet-item">
                <span className="lbl">Toplam alacak</span>
                <strong className="desk-num">{formatTry(alacak.toplamTutar)}</strong>
              </div>
              <div className="desk-icra-detay-ozet-item">
                <span className="lbl">Taksit toplamı</span>
                <strong className="desk-num">{formatTry(ozet.taksitToplam)}</strong>
              </div>
              <div className="desk-icra-detay-ozet-item">
                <span className="lbl">Tahsil edilen</span>
                <strong className="desk-num">{formatTry(alacak.odenenToplam)}</strong>
              </div>
              <div className="desk-icra-detay-ozet-item">
                <span className="lbl">Kalan</span>
                <strong className="desk-num">{formatTry(alacak.kalanTutar)}</strong>
              </div>
              <div className="desk-icra-detay-ozet-item">
                <span className="lbl">Dağıtılmamış fark</span>
                <strong className={`desk-num${!ozet.eslesiyor ? " desk-icra-detay-ozet-warn" : ""}`}>
                  {formatTry(ozet.fark)}
                </strong>
              </div>
              <div className="desk-icra-detay-ozet-item">
                <span className="lbl">Durum</span>
                <span className={icraAlacakDurumBadgeClass(alacak.durum)}>{icraAlacakDurumEtiket(alacak.durum)}</span>
              </div>
            </div>

            {!ozet.eslesiyor ? (
              <p className="desk-icra-detay-uyari" role="status">
                Taksit toplamı alacak tutarıyla eşleşmiyor.
              </p>
            ) : null}

            <div className="desk-icra-detay-table-wrap">
              {yukleniyor ? (
                <p className="empty-state">Yükleniyor…</p>
              ) : taksitler.length === 0 ? (
                <p className="empty-state">Taksit kaydı yok.</p>
              ) : (
                <table className="desk-table desk-table--striped desk-icra-taksit-table desk-icra-detay-table data-table">
                  <colgroup>
                    <col className="col-no" />
                    <col className="col-vade" />
                    <col className="col-tutar" />
                    <col className="col-odenen" />
                    <col className="col-kalan" />
                    <col className="col-durum" />
                    <col className="col-son" />
                    <col className="col-smm" />
                    <col className="col-islem" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="col-center">Taksit</th>
                      <th className="col-center">Vade</th>
                      <th className="num">Tutar</th>
                      <th className="num">Ödenen</th>
                      <th className="num">Kalan</th>
                      <th>Durum</th>
                      <th className="col-center">Son ödeme</th>
                      <th className="col-center">SMM</th>
                      <th className="col-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taksitler.map((t) => {
                      const smm = icraTaksitSmmHucre(t.smmDurumu);
                      return (
                        <tr key={t.id} className={satirAktif(t) ? "desk-icra-detay-row--aktif" : undefined}>
                          <td className="col-center">{t.taksitNo}</td>
                          <td className="col-center">{formatDateTr(t.vadeTarihi)}</td>
                          <td className="num">
                            <span className="desk-icra-money">{formatTry(t.tutar)}</span>
                          </td>
                          <td className="num">
                            <span className="desk-icra-money">{formatTry(t.odenenToplam)}</span>
                          </td>
                          <td className="num">
                            <span className="desk-icra-money">{formatTry(t.kalanTutar)}</span>
                          </td>
                          <td className="desk-icra-detay-durum">
                            <span className={icraTaksitDurumBadgeClass(t.durum)} title={icraTaksitDurumEtiket(t.durum)}>
                              {icraTaksitDurumEtiket(t.durum)}
                            </span>
                          </td>
                          <td className="col-center">{formatDateTr(t.sonOdemeTarihi)}</td>
                          <td className="col-center desk-smm-warn-cell">
                            <div className="desk-icra-smm-cell">
                              {smm.className ? (
                                <span className={smm.className}>{smm.label}</span>
                              ) : (
                                <span className="desk-icra-smm-label">{smm.label}</span>
                              )}
                              {t.smmDurumu === "BEKLIYOR" && t.smmBekleyenOdemeId != null ? (
                                <DeskTableIconBtn
                                  title="SMM Kesildi"
                                  variant="warning"
                                  onClick={() => void smmKes(t.smmBekleyenOdemeId!)}
                                >
                                  <IconSmm />
                                </DeskTableIconBtn>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div className="desk-icra-taksit-actions">
                              {t.kalanTutar > 0.001 ? (
                                <DeskTableIconBtn title="Ödeme al" variant="primary" onClick={() => setOdemeTaksit(t)}>
                                  <IconLira />
                                </DeskTableIconBtn>
                              ) : null}
                              <DeskTableIconBtn title="Ödeme geçmişi" onClick={() => setGecmisTaksit(t)}>
                                <IconGecmis />
                              </DeskTableIconBtn>
                              <DeskTableIconBtn title="Düzenle" onClick={() => setDuzenleTaksit(t)}>
                                <IconDuzenle />
                              </DeskTableIconBtn>
                              {t.odenenToplam <= 0.001 ? (
                                <DeskTableIconBtn title="Sil" variant="danger" onClick={() => void taksitSil(t.id)}>
                                  <IconSil />
                                </DeskTableIconBtn>
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
        </div>
      </DeskModalBackdrop>

      <IcraTahsilatTaksitOdemeModal
        open={odemeTaksit != null}
        taksit={odemeTaksit}
        onClose={() => setOdemeTaksit(null)}
        onSaved={yenile}
      />

      <IcraTahsilatTaksitGecmisModal
        open={gecmisTaksit != null}
        taksit={gecmisTaksit}
        onClose={() => setGecmisTaksit(null)}
        onChanged={yenile}
      />

      <IcraTahsilatTaksitDuzenleModal
        open={duzenleTaksit != null}
        taksit={duzenleTaksit}
        onClose={() => setDuzenleTaksit(null)}
        onSaved={yenile}
      />
    </DeskModalPortal>
  );
}
