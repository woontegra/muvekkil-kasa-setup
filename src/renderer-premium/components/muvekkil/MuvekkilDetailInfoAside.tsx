import type { ReactNode } from "react";
import type { Muvekkil } from "@shared/types/muvekkil";
import { muvekkilAlanDegeri } from "../../lib/muvekkil";

type InfoRow = { icon: ReactNode; label: string; value: string };

function InfoField({ icon, label, value }: InfoRow) {
  const bos = value === "—";
  return (
    <div className={`pm-mvk-info-field${bos ? " pm-mvk-info-field--empty" : ""}`}>
      <div className="pm-mvk-info-field-icon" aria-hidden>
        {icon}
      </div>
      <div className="pm-mvk-info-field-body">
        <span className="pm-mvk-info-field-label">{label}</span>
        <span className="pm-mvk-info-field-value">{value}</span>
      </div>
    </div>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.75 };

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  );
}

function IconNote() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} aria-hidden>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function tuzelAlanlar(m: Muvekkil): InfoRow[] {
  return [
    { icon: <IconUser />, label: "Yetkili", value: muvekkilAlanDegeri(m.yetkiliAdSoyad) },
    { icon: <IconPhone />, label: "Yetkili telefon", value: muvekkilAlanDegeri(m.yetkiliTelefon) },
    { icon: <IconUser />, label: "Müdür", value: muvekkilAlanDegeri(m.mudurAdSoyad) },
    { icon: <IconPhone />, label: "Müdür telefon", value: muvekkilAlanDegeri(m.mudurTelefon) },
    { icon: <IconUser />, label: "Muhasebe", value: muvekkilAlanDegeri(m.muhasebeAdSoyad) },
    { icon: <IconPhone />, label: "Muhasebe telefon", value: muvekkilAlanDegeri(m.muhasebeTelefon) },
    { icon: <IconBuilding />, label: "Vergi no", value: muvekkilAlanDegeri(m.vergiNo) },
    { icon: <IconBuilding />, label: "Vergi dairesi", value: muvekkilAlanDegeri(m.vergiDairesi) },
  ];
}

function gercekAlanlar(m: Muvekkil): InfoRow[] {
  return [{ icon: <IconPhone />, label: "Telefon", value: muvekkilAlanDegeri(m.telefon) }];
}

type Props = { muvekkil: Muvekkil };

export function MuvekkilDetailInfoAside({ muvekkil: m }: Props) {
  const alanlar: InfoRow[] = [
    ...(m.muvekkilTuru === "TUZEL_KISI" ? tuzelAlanlar(m) : gercekAlanlar(m)),
    { icon: <IconMail />, label: "E-posta", value: muvekkilAlanDegeri(m.eposta) },
    { icon: <IconPin />, label: "Adres", value: muvekkilAlanDegeri(m.adres) },
  ];

  const not = (m.not ?? "").trim();

  return (
    <aside className="pm-mvk-detail-aside" aria-label="Müvekkil bilgileri">
      <h3 className="pm-mvk-detail-panel-title">İletişim bilgileri</h3>
      <div className="pm-mvk-info-grid">
        {alanlar.map((a) => (
          <InfoField key={a.label} {...a} />
        ))}
      </div>
      {not ? (
        <div className="pm-mvk-detail-note">
          <div className="pm-mvk-detail-note-head">
            <IconNote />
            <span>Not</span>
          </div>
          <p>{not}</p>
        </div>
      ) : null}
    </aside>
  );
}
