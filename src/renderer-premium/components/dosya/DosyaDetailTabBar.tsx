export type DosyaDetailTab = "genel" | "maliOzet" | "ekstre";

type Props = {
  active: DosyaDetailTab;
  onChange: (tab: DosyaDetailTab) => void;
};

const TABS: { id: DosyaDetailTab; label: string }[] = [
  { id: "genel", label: "Genel" },
  { id: "maliOzet", label: "Mali özet" },
  { id: "ekstre", label: "Müvekkil ekstresi" },
];

export function DosyaDetailTabBar({ active, onChange }: Props) {
  return (
    <nav className="pm-dosya-tabs" aria-label="Dosya görünümü">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`pm-dosya-tab${active === t.id ? " pm-dosya-tab--active" : ""}`}
          aria-current={active === t.id ? "page" : undefined}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
