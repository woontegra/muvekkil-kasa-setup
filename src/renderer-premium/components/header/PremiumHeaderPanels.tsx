import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { TahsilatMerkeziOzet } from "@shared/types/tahsilatMerkezi";
import { canMaliKontrol } from "@shared/lib/rolYetki";
import { usePremiumAuth } from "../../context/PremiumAuthContext";
import { usePremiumLicense } from "../../context/PremiumLicenseContext";
import { usePremiumToast } from "../../context/PremiumToastContext";
import { DashboardQuickActions } from "../dashboard/DashboardQuickActions";
import { DashboardTahsilatPanel } from "../dashboard/DashboardTahsilatPanel";
import { MaliKontrolCard } from "../overview/MaliKontrolCard";
import { PremiumMuvekkilFormModal } from "../muvekkil/PremiumMuvekkilFormModal";
import { MKD_MUVEKKIL_CHANGED, MKD_OVERVIEW_REFRESH } from "../../lib/events";

type PanelId = "quick" | "mali" | "tahsilat";

const PANEL_WIDTH: Record<PanelId, number> = { quick: 300, mali: 360, tahsilat: 320 };
const VIEWPORT_MARGIN = 8;
const HOVER_CLOSE_DELAY_MS = 160;
const FOCUSABLE = "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])";
/** Açılışta yenileme için asgari aralık; art arda hover sorgu yağdırmasın. */
const REFRESH_MIN_INTERVAL_MS = 15_000;

type PopoverPos = { top: number; left: number; width: number; maxHeight: number };

function computePos(trigger: HTMLElement, desiredWidth: number): PopoverPos {
  const r = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(desiredWidth, vw - VIEWPORT_MARGIN * 2);
  const left = Math.min(Math.max(r.left, VIEWPORT_MARGIN), vw - width - VIEWPORT_MARGIN);
  const top = r.bottom + 6;
  return { top, left, width, maxHeight: Math.max(160, vh - top - VIEWPORT_MARGIN) };
}

function ChipIcon({ id }: { id: PanelId }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9 };
  if (id === "quick") {
    return (
      <svg {...common} aria-hidden>
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
      </svg>
    );
  }
  if (id === "mali") {
    return (
      <svg {...common} aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2H4Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}

type ItemProps = {
  id: PanelId;
  label: string;
  openId: PanelId | null;
  onOpen: (id: PanelId, via: "hover" | "click") => void;
  onClose: (id: PanelId) => void;
  onToggleClick: (id: PanelId) => void;
  children: ReactNode;
};

function HeaderPanelItem({ id, label, openId, onOpen, onClose, onToggleClick, children }: ItemProps) {
  const open = openId === id;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const popId = `pm-hq-pop-${id}`;

  const cancelClose = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  useEffect(() => cancelClose, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      if (triggerRef.current) setPos(computePos(triggerRef.current, PANEL_WIDTH[id]));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, id]);

  const focusFirstPending = useRef(false);

  const focusFirst = () => popRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

  useEffect(() => {
    if (!open || !focusFirstPending.current) return;
    focusFirstPending.current = false;
    focusFirst();
  }, [open]);

  function focusFirstInPopover() {
    if (open) focusFirst();
    else focusFirstPending.current = true;
  }

  return (
    <div
      ref={rootRef}
      className={`pm-hq-item${open ? " pm-hq-item--open" : ""}`}
      data-hq={id}
      onMouseEnter={() => {
        cancelClose();
        onOpen(id, "hover");
      }}
      onMouseLeave={() => {
        cancelClose();
        closeTimer.current = window.setTimeout(() => {
          closeTimer.current = null;
          onClose(id);
        }, HOVER_CLOSE_DELAY_MS);
      }}
      onKeyDown={(e) => {
        // Portal içindeki modal olayları React ağacından buraya da kabarır; yalnızca kendi DOM'umuzu ele al.
        if (e.key !== "Escape" || !open || !rootRef.current?.contains(e.target as Node)) return;
        e.stopPropagation();
        onClose(id);
        triggerRef.current?.focus();
      }}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (open && next && !rootRef.current?.contains(next)) onClose(id);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="pm-hq-chip"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={popId}
        title={label}
        onClick={() => onToggleClick(id)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onOpen(id, "click");
            focusFirstInPopover();
          }
        }}
      >
        <span className="pm-hq-chip-icon">
          <ChipIcon id={id} />
        </span>
        <span className="pm-hq-chip-label">{label}</span>
      </button>
      <div
        ref={popRef}
        id={popId}
        role="dialog"
        aria-label={label}
        className="pm-hq-pop"
        hidden={!open}
        onClickCapture={(e) => {
          const target = e.target as HTMLElement;
          // Portal (modal) tıklamaları React ağacından buraya kabarır; yalnızca kartın kendi eylemleri kapatır.
          if (!popRef.current?.contains(target) || !target.closest("a, button")) return;
          window.setTimeout(() => onClose(id), 0);
        }}
        style={
          open && pos
            ? { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

/** Ortak üst çubuk: Hızlı İşlemler, Mali Kontrol ve Tahsilat açılır kartları. */
export function PremiumHeaderPanels() {
  const location = useLocation();
  const { user } = usePremiumAuth();
  const { checkLicense } = usePremiumLicense();
  const { showToast } = usePremiumToast();
  const maliKontrolAcik = canMaliKontrol(user?.rol);

  const [openId, setOpenId] = useState<PanelId | null>(null);
  const openedViaClick = useRef(false);

  const [lisansKontrol, setLisansKontrol] = useState(false);
  const [muvekkilModalOpen, setMuvekkilModalOpen] = useState(false);

  const [tahsilatOzet, setTahsilatOzet] = useState<TahsilatMerkeziOzet | null>(null);
  const [tahsilatLoading, setTahsilatLoading] = useState(false);
  const tahsilatLoadedAt = useRef(0);
  const [maliRefreshKey, setMaliRefreshKey] = useState(0);
  const maliLoadedAt = useRef(Date.now());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const yukleTahsilat = useCallback(async () => {
    tahsilatLoadedAt.current = Date.now();
    setTahsilatLoading(true);
    try {
      const tahsil = await window.api.tahsilatMerkeziOzet();
      if (mountedRef.current) setTahsilatOzet(tahsil);
    } catch {
      if (mountedRef.current) setTahsilatOzet(null);
    } finally {
      if (mountedRef.current) setTahsilatLoading(false);
    }
  }, []);

  useEffect(() => {
    const onRefresh = () => {
      tahsilatLoadedAt.current = 0;
      maliLoadedAt.current = 0;
    };
    window.addEventListener(MKD_OVERVIEW_REFRESH, onRefresh);
    window.addEventListener("mkd:accounting-period-changed", onRefresh);
    return () => {
      window.removeEventListener(MKD_OVERVIEW_REFRESH, onRefresh);
      window.removeEventListener("mkd:accounting-period-changed", onRefresh);
    };
  }, []);

  useEffect(() => {
    setOpenId(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!openId) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest(".pm-hq-item")) setOpenId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openId]);

  const refreshOnOpen = useCallback(
    (id: PanelId) => {
      const now = Date.now();
      if (id === "tahsilat" && now - tahsilatLoadedAt.current > REFRESH_MIN_INTERVAL_MS) {
        void yukleTahsilat();
      }
      if (id === "mali" && now - maliLoadedAt.current > REFRESH_MIN_INTERVAL_MS) {
        maliLoadedAt.current = now;
        setMaliRefreshKey((k) => k + 1);
      }
    },
    [yukleTahsilat],
  );

  const openPanel = useCallback(
    (id: PanelId, via: "hover" | "click") => {
      if (openId !== id) {
        openedViaClick.current = via === "click";
        refreshOnOpen(id);
        setOpenId(id);
      } else if (via === "click") {
        openedViaClick.current = true;
      }
    },
    [openId, refreshOnOpen],
  );

  const closePanel = useCallback((id: PanelId) => {
    setOpenId((cur) => (cur === id ? null : cur));
  }, []);

  const toggleClick = useCallback(
    (id: PanelId) => {
      if (openId === id && openedViaClick.current) {
        setOpenId(null);
        return;
      }
      openPanel(id, "click");
    },
    [openId, openPanel],
  );

  async function lisansKontrolEt() {
    if (lisansKontrol) return;
    setLisansKontrol(true);
    try {
      const result = await checkLicense();
      if (result.ok) {
        showToast("success", result.message?.trim() || "Lisans doğrulandı.");
      } else {
        showToast("error", result.error?.trim() || "Lisans doğrulanamadı.");
      }
    } catch {
      showToast("error", "Lisans kontrolü sırasında bir hata oluştu.");
    } finally {
      setLisansKontrol(false);
    }
  }

  function yeniMuvekkilAc() {
    setOpenId(null);
    setMuvekkilModalOpen(true);
  }

  const itemProps = { openId, onOpen: openPanel, onClose: closePanel, onToggleClick: toggleClick };

  return (
    <div className="pm-hq" role="group" aria-label="Hızlı paneller">
      <HeaderPanelItem id="quick" label="Hızlı İşlemler" {...itemProps}>
        <DashboardQuickActions
          licenseBusy={lisansKontrol}
          onNewMuvekkil={yeniMuvekkilAc}
          onLicenseCheck={() => void lisansKontrolEt()}
        />
      </HeaderPanelItem>
      {maliKontrolAcik ? (
        <HeaderPanelItem id="mali" label="Mali Kontrol" {...itemProps}>
          <MaliKontrolCard enabled={maliKontrolAcik} refreshKey={maliRefreshKey} />
        </HeaderPanelItem>
      ) : null}
      <HeaderPanelItem id="tahsilat" label="Tahsilat" {...itemProps}>
        <DashboardTahsilatPanel ozet={tahsilatOzet} loading={tahsilatLoading} />
      </HeaderPanelItem>

      <PremiumMuvekkilFormModal
        open={muvekkilModalOpen}
        onClose={() => setMuvekkilModalOpen(false)}
        onSuccess={() => window.dispatchEvent(new CustomEvent(MKD_MUVEKKIL_CHANGED))}
      />
    </div>
  );
}
