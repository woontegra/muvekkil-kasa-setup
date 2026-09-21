import { Link } from "react-router-dom";
import type { Dosya } from "@shared/types/dosya";
import type { Muvekkil } from "@shared/types/muvekkil";
import { dosyaDurumEtiket, dosyaDurumTone } from "../../lib/dosya";
import { muvekkilGorunenAd } from "../../lib/muvekkil";
import { PremiumButton } from "../PremiumButton";
import { StatusBadge } from "../StatusBadge";

type Props = {
  muvekkil: Muvekkil;
  dosya: Dosya;
  muvekkilId: number;
  onEdit: () => void;
  onIslemEkle: () => void;
  onHesapOzeti: () => void;
  onMaliOzet?: () => void;
  onEkstre?: () => void;
};

export function DosyaInfoPanel({
  muvekkil,
  dosya,
  muvekkilId,
  onEdit,
  onIslemEkle,
  onHesapOzeti,
  onMaliOzet,
  onEkstre,
}: Props) {
  const mAd = muvekkilGorunenAd(muvekkil);

  return (
    <div className="pm-dosya-info pm-dosya-stagger">
      <nav className="pm-breadcrumb" aria-label="Konum">
        <Link to="/muvekkiller">Müvekkiller</Link>
        <span aria-hidden>/</span>
        <Link to={`/muvekkil/${muvekkilId}`}>{mAd}</Link>
        <span aria-hidden>/</span>
        <span className="pm-breadcrumb-current">{(dosya.konuBasligi ?? "").trim() || "Dosya"}</span>
      </nav>

      <div className="pm-dosya-info-title-row">
        <h2 className="pm-dosya-info-title">{(dosya.konuBasligi ?? "").trim() || "Dosya"}</h2>
        <StatusBadge tone={dosyaDurumTone(dosya.durum)}>{dosyaDurumEtiket(dosya.durum)}</StatusBadge>
      </div>

      <div className="pm-dosya-info-grid">
        <div className="pm-dosya-kv">
          <span className="pm-dosya-kv-k">Müvekkil</span>
          <span className="pm-dosya-kv-v">{mAd}</span>
        </div>
        <div className="pm-dosya-kv">
          <span className="pm-dosya-kv-k">Konu</span>
          <span className="pm-dosya-kv-v">{(dosya.konuBasligi ?? "").trim() || "—"}</span>
        </div>
        <div className="pm-dosya-kv">
          <span className="pm-dosya-kv-k">Mahkeme / İcra</span>
          <span className="pm-dosya-kv-v">{(dosya.mahkemeAdi ?? "").trim() || "—"}</span>
        </div>
        <div className="pm-dosya-kv">
          <span className="pm-dosya-kv-k">Dosya numarası</span>
          <span className="pm-dosya-kv-v">{(dosya.dosyaNumarasi ?? "").trim() || "—"}</span>
        </div>
        <div className="pm-dosya-kv pm-dosya-kv--wide">
          <span className="pm-dosya-kv-k">Not</span>
          <span className="pm-dosya-kv-v">{(dosya.not ?? "").trim() || "—"}</span>
        </div>
      </div>

      <div className="pm-dosya-actions">
        <PremiumButton type="button" onClick={onIslemEkle}>
          + İşlem ekle
        </PremiumButton>
        <PremiumButton type="button" variant="ghost" onClick={onEdit}>
          Dosyayı düzenle
        </PremiumButton>
        <Link className="pm-btn pm-btn--ghost" to={`/muvekkil/${muvekkilId}`}>
          Müvekkile dön
        </Link>
        <PremiumButton type="button" variant="ghost" onClick={onHesapOzeti}>
          Hesap özeti yazdır
        </PremiumButton>
        {onMaliOzet ? (
          <PremiumButton type="button" variant="ghost" onClick={onMaliOzet}>
            Mali özet
          </PremiumButton>
        ) : null}
        {onEkstre ? (
          <PremiumButton type="button" variant="ghost" onClick={onEkstre}>
            Müvekkil ekstresi
          </PremiumButton>
        ) : null}
      </div>
    </div>
  );
}
