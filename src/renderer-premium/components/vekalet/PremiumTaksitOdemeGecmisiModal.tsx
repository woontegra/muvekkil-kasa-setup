import type { VekaletTaksit, VekaletTaksitOdeme } from "@shared/types/vekalet";
import { formatDateTr } from "../../lib/format";
import { formatMoney } from "@shared/lib/paraBirimi";
import { odemeEtiket } from "../../lib/kasa";
import { StatusBadge } from "../StatusBadge";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

type Props = {
  open: boolean;
  taksit: VekaletTaksit;
  odemeler: VekaletTaksitOdeme[];
  onClose: () => void;
  onSmmKes: (odemeId: number) => void;
  onMakbuz: (odemeId: number) => void;
  onGuvenliIptal?: (odemeId: number) => void;
  onDuzenle?: (odeme: VekaletTaksitOdeme) => void;
};

export function PremiumTaksitOdemeGecmisiModal({
  open,
  taksit,
  odemeler,
  onClose,
  onSmmKes,
  onMakbuz,
  onGuvenliIptal,
  onDuzenle,
}: Props) {
  return (
    <PremiumModal
      open={open}
      title={`Taksit #${taksit.taksitNo} — ödeme geçmişi`}
      wide
      onClose={onClose}
      footer={
        <PremiumButton type="button" variant="ghost" onClick={onClose}>
          Kapat
        </PremiumButton>
      }
    >
      <div className="pm-vekalet-table-wrap">
        <table className="pm-vekalet-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th className="num">Tutar</th>
              <th>Ödeme yöntemi</th>
              <th>Açıklama</th>
              <th>Makbuz no</th>
              <th>SMM durumu</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {odemeler.length === 0 ? (
              <tr>
                <td colSpan={7} className="pm-muted">
                  Ödeme kaydı yok.
                </td>
              </tr>
            ) : (
              odemeler.map((o) => {
                const iptal = o.makbuzDurumu === "IPTAL" || !!o.iptalTarihi;
                return (
                <tr key={o.id} className={iptal ? "pm-vekalet-row-iptal" : undefined}>
                  <td>{formatDateTr(o.odemeTarihi)}</td>
                  <td className="num">
                    {formatMoney(o.tutar, o.alacakParaBirimi)}
                    {o.odemeParaBirimi !== o.alacakParaBirimi ? ` · ${formatMoney(o.kasaTutari, o.odemeParaBirimi)}` : ""}
                  </td>
                  <td>{odemeEtiket(o.odemeYontemi)}</td>
                  <td>
                    {o.aciklama ?? "—"}
                    {o.ofisKasaHareketId ? (
                      <span className="pm-muted" title="Ofis Kasası'na gelir olarak işlendi">
                        {" "}
                        · Ofis kasası
                      </span>
                    ) : null}
                  </td>
                  <td>{o.makbuzNo ?? "—"}</td>
                  <td>
                    {iptal ? (
                      <StatusBadge tone="default">İptal</StatusBadge>
                    ) : o.smmKesildiMi ? (
                      <StatusBadge tone="success">SMM kesildi</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">SMM bekliyor</StatusBadge>
                    )}
                  </td>
                  <td>
                    <div className="pm-vekalet-actions">
                      {!iptal ? (
                        <>
                          {onDuzenle ? (
                            <button
                              type="button"
                              className="pm-vekalet-action"
                              title="Düzenle"
                              onClick={() => onDuzenle(o)}
                            >
                              ✎
                            </button>
                          ) : null}
                          <button type="button" className="pm-vekalet-action" title="Makbuz" onClick={() => onMakbuz(o.id)}>
                            🧾
                          </button>
                          {!o.smmKesildiMi ? (
                            <button
                              type="button"
                              className="pm-vekalet-action pm-vekalet-action--warning"
                              title="SMM Kesildi"
                              onClick={() => onSmmKes(o.id)}
                            >
                              SMM
                            </button>
                          ) : null}
                          {onGuvenliIptal ? (
                            <button
                              type="button"
                              className="pm-vekalet-action pm-vekalet-action--danger"
                              title="Güvenli iptal"
                              onClick={() => onGuvenliIptal(o.id)}
                            >
                              ⊘
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </PremiumModal>
  );
}
