import { PremiumFormField } from "../auth/PremiumFormField";

type Props = {
  muvekkilQ: string;
  onMuvekkilQChange: (v: string) => void;
  muvekkilId: number | "";
  onMuvekkilIdChange: (id: number | "") => void;
  muvekkiller: { id: number; label: string }[];
  muvekkilLoading?: boolean;
  muvekkilError?: string | null;
  dosyaId: number | "";
  onDosyaIdChange: (id: number | "") => void;
  dosyalar: { id: number; label: string }[];
  dosyaLoading?: boolean;
  dosyaError?: string | null;
  dosyaDisabled?: boolean;
  muvekkilFieldError?: string | null;
  dosyaFieldError?: string | null;
};

export function RaporMuvekkilDosyaFields({
  muvekkilQ,
  onMuvekkilQChange,
  muvekkilId,
  onMuvekkilIdChange,
  muvekkiller,
  muvekkilLoading,
  muvekkilError,
  dosyaId,
  onDosyaIdChange,
  dosyalar,
  dosyaLoading,
  dosyaError,
  dosyaDisabled,
  muvekkilFieldError,
  dosyaFieldError,
}: Props) {
  return (
    <div className="pm-rapor-form-grid">
      <PremiumFormField label="Müvekkil ara" htmlFor="pm-rapor-muv-q" error={muvekkilFieldError}>
        <input
          id="pm-rapor-muv-q"
          className="pm-input pm-stagger-item"
          value={muvekkilQ}
          onChange={(e) => onMuvekkilQChange(e.target.value)}
          placeholder="Ad veya unvan ile ara…"
          style={{ animationDelay: "40ms" }}
        />
      </PremiumFormField>
      <PremiumFormField label="Müvekkil" htmlFor="pm-rapor-muv" error={muvekkilError ?? undefined}>
        <select
          id="pm-rapor-muv"
          className="pm-input pm-stagger-item"
          value={muvekkilId === "" ? "" : String(muvekkilId)}
          onChange={(e) => onMuvekkilIdChange(e.target.value ? Number(e.target.value) : "")}
          disabled={muvekkilLoading}
          style={{ animationDelay: "80ms" }}
        >
          <option value="">{muvekkilLoading ? "Yükleniyor…" : "Müvekkil seçin"}</option>
          {muvekkiller.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </PremiumFormField>
      <PremiumFormField label="Dosya" htmlFor="pm-rapor-dosya" error={dosyaFieldError ?? dosyaError ?? undefined}>
        <select
          id="pm-rapor-dosya"
          className="pm-input pm-stagger-item"
          value={dosyaId === "" ? "" : String(dosyaId)}
          onChange={(e) => onDosyaIdChange(e.target.value ? Number(e.target.value) : "")}
          disabled={dosyaDisabled || dosyaLoading || muvekkilId === ""}
          style={{ animationDelay: "120ms" }}
        >
          <option value="">
            {muvekkilId === "" ? "Önce müvekkil seçin" : dosyaLoading ? "Yükleniyor…" : "Dosya seçin"}
          </option>
          {dosyalar.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </PremiumFormField>
    </div>
  );
}
