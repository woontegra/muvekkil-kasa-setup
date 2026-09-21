import { Link } from "react-router-dom";
import type { OfisKasaAnaSayfaOzet } from "@shared/types/ofisKasa";
import { getNextAccountingPeriod, getPreviousAccountingPeriod } from "@shared/lib/accountingPeriod";
import { formatDateTr, formatTry } from "../lib/format";
import { DeskModalBackdrop } from "./DeskModalBackdrop";
import { DeskModalPortal } from "./DeskModalPortal";

type Props = {
  open: boolean;
  onClose: () => void;
  summary: OfisKasaAnaSayfaOzet | null;
  onNavigate: (referenceDate: string | null) => void;
};

function modeEtiket(mode: string): string {
  return mode === "MONTHLY" ? "Aylık" : "Yıllık";
}

function netEtiket(n: number): string {
  if (n > 0) return "Dönem net (kâr)";
  if (n < 0) return "Dönem net (zarar)";
  return "Dönem net";
}

export function HesapDonemiModal({ open, onClose, summary, onNavigate }: Props) {
  if (!open || !summary) return null;

  const prev = getPreviousAccountingPeriod(summary.period);
  const next = getNextAccountingPeriod(summary.period);

  return (
    <DeskModalPortal>
      <DeskModalBackdrop onClose={onClose}>
        <div
          className="modal modal-desk"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hesap-donemi-modal-title"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="modal-head">
            <h2 id="hesap-donemi-modal-title">Hesap dönemi</h2>
          </div>
          <div className="modal-body">
            <dl className="desk-hesap-donemi-dl">
              <div>
                <dt>Dönem tipi</dt>
                <dd>{modeEtiket(summary.mode)}</dd>
              </div>
              <div>
                <dt>Dönem</dt>
                <dd>{summary.period.etiket}</dd>
              </div>
              <div>
                <dt>Başlangıç</dt>
                <dd>{formatDateTr(summary.period.bas)}</dd>
              </div>
              <div>
                <dt>Bitiş</dt>
                <dd>{formatDateTr(summary.period.bit)}</dd>
              </div>
              <div>
                <dt>Devreden bakiye</dt>
                <dd className="desk-num">{formatTry(summary.devredenBakiye)}</dd>
              </div>
              <div>
                <dt>Dönem geliri</dt>
                <dd className="desk-num">{formatTry(summary.donemGelir)}</dd>
              </div>
              <div>
                <dt>Dönem gideri</dt>
                <dd className="desk-num">{formatTry(summary.donemGider)}</dd>
              </div>
              <div>
                <dt>{netEtiket(summary.donemNetSonucu)}</dt>
                <dd className="desk-num">{formatTry(summary.donemNetSonucu)}</dd>
              </div>
            </dl>
          </div>
          <div className="modal-actions desk-hesap-donemi-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onNavigate(prev.bas)}
            >
              Önceki dönem
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!summary.canGoNext || !next}
              onClick={() => next && onNavigate(next.bas)}
            >
              Sonraki dönem
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={summary.isCurrent}
              onClick={() => onNavigate(null)}
            >
              Güncel döneme dön
            </button>
            <Link
              to="/ayarlar/ofis#hesap-donemi"
              className="btn btn-sm btn-outline-primary"
              onClick={onClose}
            >
              Dönem ayarlarına git
            </Link>
            <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
              Kapat
            </button>
          </div>
        </div>
      </DeskModalBackdrop>
    </DeskModalPortal>
  );
}
