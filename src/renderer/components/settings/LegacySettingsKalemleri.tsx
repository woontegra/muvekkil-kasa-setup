import { useCallback, useEffect, useState } from "react";

type Kalem = {
  id: number;
  tur: "GELIR" | "GIDER";
  kod: string | null;
  ad: string;
  aktif: boolean;
  sistemMi: boolean;
  sira: number;
};

export function LegacySettingsKalemleri() {
  const [tur, setTur] = useState<"GELIR" | "GIDER">("GELIR");
  const [rows, setRows] = useState<Kalem[]>([]);
  const [yeniAd, setYeniAd] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editAd, setEditAd] = useState("");
  const [busy, setBusy] = useState(false);
  const [mesaj, setMesaj] = useState<{ tip: "ok" | "err"; metin: string } | null>(null);

  const yukle = useCallback(async () => {
    const list = await window.api.finansKalemiList({ tur, aktif: "all", includeSistem: true });
    setRows(list as Kalem[]);
  }, [tur]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const aktifManuel = rows.filter((r) => r.aktif && !r.sistemMi);
  const pasifManuel = rows.filter((r) => !r.aktif && !r.sistemMi);
  const sistem = rows.filter((r) => r.sistemMi);

  async function ekle() {
    if (busy) return;
    setBusy(true);
    setMesaj(null);
    try {
      const r = await window.api.finansKalemiCreate(tur, yeniAd);
      if (!r.ok) {
        setMesaj({ tip: "err", metin: r.error });
        return;
      }
      setYeniAd("");
      setMesaj({ tip: "ok", metin: "Kalem eklendi." });
      await yukle();
    } finally {
      setBusy(false);
    }
  }

  async function kaydetDuzenle() {
    if (editId == null || busy) return;
    setBusy(true);
    setMesaj(null);
    try {
      const r = await window.api.finansKalemiUpdate(editId, editAd);
      if (!r.ok) {
        setMesaj({ tip: "err", metin: r.error });
        return;
      }
      setEditId(null);
      setMesaj({ tip: "ok", metin: "Kalem güncellendi." });
      await yukle();
    } finally {
      setBusy(false);
    }
  }

  async function sirala(id: number, yon: -1 | 1) {
    const ids = aktifManuel.map((k) => k.id);
    const i = ids.indexOf(id);
    const j = i + yon;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    const r = await window.api.finansKalemiReorder(tur, next);
    if (!r.ok) {
      setMesaj({ tip: "err", metin: r.error });
      return;
    }
    await yukle();
  }

  return (
    <section id="gelir-gider-kalemleri" className="section-card desk-panel desk-office-settings-panel">
      <div className="desk-panel-head">
        <span>Gelir ve Gider Kalemleri</span>
        <span className="desk-panel-meta">ofis kasası</span>
      </div>
      <div className="desk-panel-body desk-panel-body--pad-sm">
        <div className="desk-form-grid" style={{ marginBottom: 12 }}>
          <div className="field">
            <label htmlFor="lg-kalem-tur">Tür</label>
            <select
              id="lg-kalem-tur"
              className="desk-input"
              value={tur}
              onChange={(e) => setTur(e.target.value as "GELIR" | "GIDER")}
            >
              <option value="GELIR">Gelir Kalemleri</option>
              <option value="GIDER">Gider Kalemleri</option>
            </select>
          </div>
          <div className="field desk-form-span2">
            <label htmlFor="lg-kalem-yeni">Yeni kalem</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="lg-kalem-yeni"
                className="desk-input"
                value={yeniAd}
                onChange={(e) => setYeniAd(e.target.value)}
                placeholder="Kalem adı"
                maxLength={120}
              />
              <button type="button" className="btn btn-primary btn-sm" disabled={busy || !yeniAd.trim()} onClick={() => void ekle()}>
                Ekle
              </button>
            </div>
          </div>
        </div>
        {mesaj ? (
          <p className={mesaj.tip === "ok" ? "desk-msg-ok" : "form-error"} role="status">
            {mesaj.metin}
          </p>
        ) : null}

        <h3 className="desk-subsection-title">Aktif kalemler</h3>
        {aktifManuel.length === 0 ? (
          <p className="desk-muted-compact">Manuel aktif kalem yok.</p>
        ) : (
          <ul className="desk-kalem-list">
            {aktifManuel.map((k) => (
              <li key={k.id} className="desk-kalem-row">
                {editId === k.id ? (
                  <>
                    <input className="desk-input" value={editAd} onChange={(e) => setEditAd(e.target.value)} />
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => void kaydetDuzenle()}>
                      Kaydet
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setEditId(null)}>
                      Vazgeç
                    </button>
                  </>
                ) : (
                  <>
                    <span>{k.ad}</span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        setEditId(k.id);
                        setEditAd(k.ad);
                      }}
                    >
                      Düzenle
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => void sirala(k.id, -1)}>
                      Yukarı
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => void sirala(k.id, 1)}>
                      Aşağı
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void window.api.finansKalemiArchive(k.id).then(() => yukle())}
                    >
                      Kaldır
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {pasifManuel.length > 0 ? (
          <>
            <h3 className="desk-subsection-title">Kaldırılmış</h3>
            <ul className="desk-kalem-list">
              {pasifManuel.map((k) => (
                <li key={k.id} className="desk-kalem-row">
                  <span className="muted">{k.ad}</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void window.api.finansKalemiActivate(k.id).then(() => yukle())}
                  >
                    Geri al
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <h3 className="desk-subsection-title">Sistem kalemleri</h3>
        <ul className="desk-kalem-list">
          {sistem.map((k) => (
            <li key={k.id} className="desk-kalem-row">
              <span>{k.ad}</span>
              <span className="muted">Sistem · düzenlenemez</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
