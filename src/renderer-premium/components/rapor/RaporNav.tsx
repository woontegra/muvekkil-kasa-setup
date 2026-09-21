import type { RaporCategoryId } from "../../lib/raporTypes";
import { RAPOR_NAV } from "../../lib/raporTypes";

type Props = {
  active: RaporCategoryId;
  onChange: (id: RaporCategoryId) => void;
};

function NavIcon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "wallet":
      return (
        <svg {...common}>
          <path d="M19 7H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
          <path d="M16 14h.01" />
          <path d="M3 10h18" />
        </svg>
      );
    case "scale":
      return (
        <svg {...common}>
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...common}>
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M8 10h8M8 14h5" />
        </svg>
      );
    case "stamp":
      return (
        <svg {...common}>
          <path d="M5 21h14" />
          <path d="M12 3 7 10h10Z" />
          <path d="M9 14h6" />
        </svg>
      );
    default:
      return null;
  }
}

export function RaporNav({ active, onChange }: Props) {
  return (
    <nav className="pm-rapor-nav" aria-label="Rapor kategorileri">
      <ul className="pm-rapor-nav-list">
        {RAPOR_NAV.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`pm-rapor-nav-btn${isActive ? " pm-rapor-nav-btn--active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onChange(item.id)}
              >
                <span className="pm-rapor-nav-icon">
                  <NavIcon name={item.icon} />
                </span>
                <span className="pm-rapor-nav-text">
                  <span className="pm-rapor-nav-label">{item.label}</span>
                  <span className="pm-rapor-nav-desc">{item.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
