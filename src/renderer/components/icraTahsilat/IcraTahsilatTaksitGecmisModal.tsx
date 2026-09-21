import { useCallback, useEffect, useState } from "react";
import type { IcraTahsilatOdeme, IcraTahsilatTaksit } from "@shared/types/icraTahsilat";
import { OFIS_ODEME_YONTEMI_ETIKET } from "@shared/constants/ofisKasa";
import { DeskTableIconBtn } from "../DeskTableIconBtn";
import { IconSmm } from "../DeskTableIcons";
import { formatDateTr, formatTry } from "../../lib/format";
import { DeskModalBackdrop } from "../DeskModalBackdrop";

type Props = {
  open: boolean;
  taksit: IcraTahsilatTaksit | null;
  onClose: () => void;
  onChanged: () => void;
};

export function IcraTahsilatTaksitGecmisModal({ open, taksit, onClose, onChanged }: Props) {
  const [gecmis, setGecmis] = useState<IcraTahsilatOdeme[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  const yukle = useCallback(async () => {
    if (!taksit) return;
    setYukleniyor(true);
    try {
      const list = await window.api?.icraTahsilatTaksitOdemeGecmisi?.(taksit.id);
      setGecmis(Array.isArray(list) ? list : []);
    } catch {
      setGecmis([]);
    } finally {
      setYukleniyor(false);
    }
  }, [taksit]);

  useEffect(() => {
    if (open && taksit) void yukle();
  }, [open, taksit, yukle]);

  async function smmKes(odemeId: number) {
    const res = await window.api?.icraTahsilatSmmKesildi?.(odemeId);
    if (!res?.ok) {
      alert(res?.error ?? "SMM güncellenemedi");
      return;
    }
    onChanged();
    void yukle();
  }

  if (!open || !taksit) return null;

  return (
    <DeskModalBackdrop className="modal-backdrop desk-icra-submodal-backdrop" onClose={onClose}>
      <div
        className="modal modal-desk modal-desk--icra-taksit-gecmis"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="icra-taksit-gecmis-title"
      >
        <div className="modal-header desk-icra-submodal-header">
          <h2 id="icra-taksit-gecmis-title">Ödeme geçmişi</h2>
          <button type="button" className="desk-icra-detay-close" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>
        <div className="modal-body desk-icra-submodal-body desk-icra-gecmis-modal-body">
          <p className="desk-icra-submodal-meta">Taksit No: {taksit.taksitNo}</p>
          {yukleniyor ? (
            <p className="empty-state">Yükleniyor…</p>
          ) : gecmis.length === 0 ? (
            <p className="empty-state">Bu taksit için ödeme kaydı yok.</p>
          ) : (
            <div className="desk-icra-gecmis-table-wrap desk-icra-gecmis-modal-table-wrap">
              <table className="desk-table desk-table--striped desk-icra-gecmis-table data-table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th className="num">Tutar</th>
                    <th>Yöntem</th>
                    <th>Açıklama</th>
                    <th>SMM</th>
                    <th>Ofis Kasası</th>
                    <th className="col-center">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {gecmis.map((o) => (
                    <tr key={o.id}>
                      <td>{formatDateTr(o.odemeTarihi)}</td>
                      <td className="num">
                        <span className="desk-icra-money">{formatTry(o.tutar)}</span>
                      </td>
                      <td>{OFIS_ODEME_YONTEMI_ETIKET[o.odemeYontemi] ?? o.odemeYontemi}</td>
                      <td>{o.aciklama?.trim() || "—"}</td>
                      <td>{o.smmKesildiMi ? "Kesildi" : "Bekliyor"}</td>
                      <td>{o.ofisKasaHareketId != null ? "Gelir yazıldı" : "—"}</td>
                      <td className="col-center">
                        {!o.smmKesildiMi ? (
                          <DeskTableIconBtn title="SMM Kesildi" variant="warning" onClick={() => void smmKes(o.id)}>
                            <IconSmm />
                          </DeskTableIconBtn>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-foot desk-icra-submodal-foot">
          <div className="desk-modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Kapat
            </button>
          </div>
        </div>
      </div>
    </DeskModalBackdrop>
  );
}
