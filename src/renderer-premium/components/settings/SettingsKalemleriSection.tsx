import { useCallback, useEffect, useMemo, useState } from "react";
import { PremiumButton } from "../PremiumButton";
import { PremiumConfirmDialog } from "../dosya/PremiumConfirmDialog";
import { SettingsSectionFrame } from "./SettingsSectionFrame";
import { usePremiumToast } from "../../context/PremiumToastContext";

type Kalem = {
  id: number;
  tur: "GELIR" | "GIDER";
  kod: string | null;
  ad: string;
  aktif: boolean;
  sistemMi: boolean;
  sira: number;
};

function sortManuel(items: Kalem[]): Kalem[] {
  return [...items].sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, "tr"));
}

export function SettingsKalemleriSection() {
  const { showToast } = usePremiumToast();
  const [tur, setTur] = useState<"GELIR" | "GIDER">("GELIR");
  const [manuelRows, setManuelRows] = useState<Kalem[]>([]);
  const [sistemRows, setSistemRows] = useState<Kalem[]>([]);
  const [yeniAd, setYeniAd] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editAd, setEditAd] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Kalem | null>(null);

  const yukle = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const [manuel, sistem] = await Promise.all([
        window.api.finansKalemiList({ tur, aktif: "all", includeSistem: false }),
        window.api.finansKalemiList({ aktif: "all", includeSistem: true }),
      ]);
      setManuelRows(sortManuel((manuel as Kalem[]).filter((r) => !r.sistemMi)));
      setSistemRows(sortManuel((sistem as Kalem[]).filter((r) => r.sistemMi)));
    } catch {
      setLoadErr("Kalem listesi yüklenemedi.");
      setManuelRows([]);
      setSistemRows([]);
    } finally {
      setLoading(false);
    }
  }, [tur]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  useEffect(() => {
    setEditId(null);
    setEditAd("");
    setYeniAd("");
  }, [tur]);

  const aktifManuel = useMemo(() => sortManuel(manuelRows.filter((r) => r.aktif)), [manuelRows]);
  const pasifManuel = useMemo(() => sortManuel(manuelRows.filter((r) => !r.aktif)), [manuelRows]);

  async function ekle() {
    if (busy) return;
    const ad = yeniAd.trim().replace(/\s+/g, " ");
    if (ad.length < 2) {
      showToast("error", "Kalem adı en az 2 karakter olmalıdır.");
      return;
    }
    setBusy(true);
    try {
      const r = await window.api.finansKalemiCreate(tur, ad);
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      setYeniAd("");
      showToast("success", "Kalem eklendi.");
      await yukle();
    } finally {
      setBusy(false);
    }
  }

  async function kaydetDuzenle() {
    if (editId == null || busy) return;
    const ad = editAd.trim().replace(/\s+/g, " ");
    if (ad.length < 2) {
      showToast("error", "Kalem adı en az 2 karakter olmalıdır.");
      return;
    }
    setBusy(true);
    try {
      const r = await window.api.finansKalemiUpdate(editId, ad);
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      setEditId(null);
      setEditAd("");
      showToast("success", "Kalem güncellendi.");
      await yukle();
    } finally {
      setBusy(false);
    }
  }

  async function sirala(id: number, yon: -1 | 1) {
    if (busy) return;
    const ids = aktifManuel.map((k) => k.id);
    const i = ids.indexOf(id);
    const j = i + yon;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    setBusy(true);
    try {
      const r = await window.api.finansKalemiReorder(tur, next);
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      await yukle();
    } finally {
      setBusy(false);
    }
  }

  async function kaldirOnay() {
    if (!archiveTarget || busy) return;
    setBusy(true);
    try {
      const r = await window.api.finansKalemiArchive(archiveTarget.id);
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      showToast("success", "Kalem kaldırıldı.");
      setArchiveTarget(null);
      await yukle();
    } finally {
      setBusy(false);
    }
  }

  async function etkinlestir(id: number) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await window.api.finansKalemiActivate(id);
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      showToast("success", "Kalem etkinleştirildi.");
      await yukle();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SettingsSectionFrame
        title="Gelir ve Gider Kalemleri"
        description="Ofis kasası ve dosya masraf formlarında görünen kalemleri yönetin. Sıra, formlardaki listeleme düzenini belirler."
        loading={loading}
        error={loadErr}
        onRetry={() => void yukle()}
      >
        <div className="pm-kalem-tabs" role="tablist" aria-label="Kalem türü">
          <button
            type="button"
            role="tab"
            aria-selected={tur === "GELIR"}
            className={`pm-kalem-tab${tur === "GELIR" ? " pm-kalem-tab--active" : ""}`}
            onClick={() => setTur("GELIR")}
          >
            Gelir Kalemleri
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tur === "GIDER"}
            className={`pm-kalem-tab${tur === "GIDER" ? " pm-kalem-tab--active" : ""}`}
            onClick={() => setTur("GIDER")}
          >
            Gider Kalemleri
          </button>
        </div>

        <div className="pm-kalem-add">
          <div className="pm-kalem-add-field">
            <label className="pm-kalem-add-label" htmlFor="pm-kalem-yeni">
              Yeni kalem adı
            </label>
            <input
              id="pm-kalem-yeni"
              className="pm-input pm-kalem-add-input"
              value={yeniAd}
              onChange={(e) => setYeniAd(e.target.value)}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void ekle();
                }
              }}
            />
          </div>
          <PremiumButton type="button" className="pm-btn--sm pm-kalem-add-btn" disabled={busy} onClick={() => void ekle()}>
            Ekle
          </PremiumButton>
        </div>

        <section className="pm-kalem-block" aria-labelledby="pm-kalem-aktif-title">
          <h3 id="pm-kalem-aktif-title" className="pm-kalem-block-title">
            Aktif kalemler
          </h3>
          {aktifManuel.length === 0 ? (
            <p className="pm-kalem-empty">Aktif manuel kalem yok.</p>
          ) : (
            <ul className="pm-kalem-rows">
              {aktifManuel.map((k, idx) => (
                <li key={k.id} className="pm-kalem-row">
                  {editId === k.id ? (
                    <>
                      <input
                        className="pm-input pm-kalem-row-edit"
                        value={editAd}
                        onChange={(e) => setEditAd(e.target.value)}
                        disabled={busy}
                        autoFocus
                      />
                      <div className="pm-kalem-row-actions">
                        <PremiumButton type="button" className="pm-btn--sm" disabled={busy} onClick={() => void kaydetDuzenle()}>
                          Kaydet
                        </PremiumButton>
                        <button
                          type="button"
                          className="pm-btn pm-btn--sm pm-btn--ghost"
                          disabled={busy}
                          onClick={() => {
                            setEditId(null);
                            setEditAd("");
                          }}
                        >
                          Vazgeç
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="pm-kalem-row-name">{k.ad}</span>
                      <div className="pm-kalem-row-actions">
                        <button
                          type="button"
                          className="pm-btn pm-btn--sm pm-btn--ghost"
                          disabled={busy}
                          onClick={() => {
                            setEditId(k.id);
                            setEditAd(k.ad);
                          }}
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="pm-btn pm-btn--sm pm-btn--ghost"
                          disabled={busy || idx === 0}
                          title="Yukarı"
                          onClick={() => void sirala(k.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="pm-btn pm-btn--sm pm-btn--ghost"
                          disabled={busy || idx === aktifManuel.length - 1}
                          title="Aşağı"
                          onClick={() => void sirala(k.id, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="pm-btn pm-btn--sm pm-btn--ghost"
                          disabled={busy}
                          onClick={() => setArchiveTarget(k)}
                        >
                          Kaldır
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {pasifManuel.length > 0 ? (
          <section className="pm-kalem-block" aria-labelledby="pm-kalem-pasif-title">
            <h3 id="pm-kalem-pasif-title" className="pm-kalem-block-title">
              Pasif kalemler
            </h3>
            <ul className="pm-kalem-rows pm-kalem-rows--dashed">
              {pasifManuel.map((k) => (
                <li key={k.id} className="pm-kalem-row">
                  <span className="pm-kalem-row-name pm-kalem-row-name--muted">{k.ad}</span>
                  <div className="pm-kalem-row-actions">
                    <button
                      type="button"
                      className="pm-btn pm-btn--sm pm-btn--ghost"
                      disabled={busy}
                      onClick={() => void etkinlestir(k.id)}
                    >
                      Etkinleştir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {sistemRows.length > 0 ? (
          <section className="pm-kalem-block" aria-labelledby="pm-kalem-sistem-title">
            <h3 id="pm-kalem-sistem-title" className="pm-kalem-block-title">
              Sistem kalemleri
            </h3>
            <p className="pm-kalem-helper">Sistem tarafından yönetilir — düzenlenemez veya kaldırılamaz.</p>
            <ul className="pm-kalem-rows pm-kalem-rows--sistem">
              {sistemRows.map((k) => (
                <li key={k.id} className="pm-kalem-row pm-kalem-row--sistem">
                  <span className="pm-kalem-lock" title="Kilitli" aria-label="Kilitli">
                    K
                  </span>
                  <span className="pm-kalem-row-name pm-kalem-row-name--muted">{k.ad}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </SettingsSectionFrame>

      <PremiumConfirmDialog
        open={archiveTarget != null}
        title="Kalemi kaldır"
        message={
          archiveTarget
            ? `"${archiveTarget.ad}" pasif hale getirilecek. Formlarda görünmez; geçmiş kayıtlar etkilenmez.`
            : ""
        }
        variant="danger"
        confirmLabel="Kaldır"
        busy={busy}
        onConfirm={() => void kaldirOnay()}
        onCancel={() => !busy && setArchiveTarget(null)}
      />
    </>
  );
}
