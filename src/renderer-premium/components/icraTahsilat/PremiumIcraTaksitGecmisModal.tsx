import { useCallback, useEffect, useState } from "react";
import type { IcraTahsilatOdeme, IcraTahsilatTaksit } from "@shared/types/icraTahsilat";
import { OFIS_ODEME_YONTEMI_ETIKET } from "@shared/constants/ofisKasa";
import { formatDateTr } from "../../lib/format";
import { formatMoney } from "@shared/lib/paraBirimi";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  open: boolean;
  taksit: IcraTahsilatTaksit | null;
  smmBusy: boolean;
  onClose: () => void;
  onSmmKes: (odemeId: number) => Promise<void>;
  onError: (msg: string) => void;
};

export function PremiumIcraTaksitGecmisModal({ open, taksit, smmBusy, onClose, onSmmKes, onError }: Props) {
  const [gecmis, setGecmis] = useState<IcraTahsilatOdeme[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  const yukle = useCallback(async () => {
    if (!taksit) return;
    setYukleniyor(true);
    try {
      const list = await window.api.icraTahsilatTaksitOdemeGecmisi(taksit.id);
      setGecmis(Array.isArray(list) ? list : []);
    } catch {
      setGecmis([]);
      onError("Ödeme geçmişi yüklenemedi.");
    } finally {
      setYukleniyor(false);
    }
  }, [taksit, onError]);

  useEffect(() => {
    if (open && taksit) void yukle();
  }, [open, taksit, yukle]);

  return (
    <PremiumModal
      open={open && taksit != null}
      title="Ödeme geçmişi"
      wide
      disabled={smmBusy}
      onClose={onClose}
      footer={
        <PremiumButton type="button" variant="ghost" onClick={onClose}>
          Kapat
        </PremiumButton>
      }
    >
      {taksit ? (
        <>
          <p className="pm-icra-submodal-meta">Taksit no: {taksit.taksitNo}</p>
          {yukleniyor ? (
            <div className="pm-icra-gecmis-skeleton" aria-hidden />
          ) : gecmis.length === 0 ? (
            <p className="pm-muted">Bu taksit için ödeme kaydı yok.</p>
          ) : (
            <div className="pm-icra-gecmis-table-wrap">
              <table className="pm-icra-gecmis-table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th className="num">Tutar</th>
                    <th>Yöntem</th>
                    <th>Açıklama</th>
                    <th>SMM</th>
                    <th>Ofis Kasası</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {gecmis.map((o) => (
                    <tr key={o.id} className="pm-icra-row-enter">
                      <td>{formatDateTr(o.odemeTarihi)}</td>
                      <td className="num">
                        {formatMoney(o.tutar, o.alacakParaBirimi)}
                        {o.odemeParaBirimi !== o.alacakParaBirimi ? ` · ${formatMoney(o.kasaTutari, o.odemeParaBirimi)}` : ""}
                      </td>
                      <td>{OFIS_ODEME_YONTEMI_ETIKET[o.odemeYontemi] ?? o.odemeYontemi}</td>
                      <td>{o.aciklama?.trim() || "—"}</td>
                      <td>{o.smmKesildiMi ? "Kesildi" : "Bekliyor"}</td>
                      <td>{o.ofisKasaHareketId != null ? "Gelir yazıldı" : "—"}</td>
                      <td>
                        {!o.smmKesildiMi ? (
                          <button
                            type="button"
                            className="pm-icra-action pm-icra-action--warning"
                            disabled={smmBusy}
                            onClick={() => void onSmmKes(o.id)}
                          >
                            SMM
                          </button>
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
        </>
      ) : null}
    </PremiumModal>
  );
}
