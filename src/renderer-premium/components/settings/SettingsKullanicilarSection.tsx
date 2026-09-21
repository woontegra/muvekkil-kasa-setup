import { useCallback, useEffect, useState } from "react";
import { PremiumButton } from "../PremiumButton";
import { SettingsSectionFrame } from "./SettingsSectionFrame";
import { usePremiumToast } from "../../context/PremiumToastContext";

type UserRow = {
  id: number;
  adSoyad: string;
  kullaniciAdi: string;
  eposta: string | null;
  telefon: string | null;
  rol: string;
  aktifMi: boolean;
};

const ROL_ETIKET: Record<string, string> = {
  BURO_SAHIBI: "Büro sahibi",
  AVUKAT_YONETICI: "Avukat / yönetici",
  KATIP_PERSONEL: "Kâtip / personel",
};

const ROL_HINT: Record<string, string> = {
  BURO_SAHIBI: "Tüm işlemlere ve ayarlara tam erişim.",
  AVUKAT_YONETICI: "Kayıtları yönetebilir, onay işlemleri yapabilir.",
  KATIP_PERSONEL: "Kayıt girebilir; yönetim ve güvenli sil sınırlıdır.",
};

export function SettingsKullanicilarSection() {
  const { showToast } = usePremiumToast();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adSoyad, setAdSoyad] = useState("");
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [sifre, setSifre] = useState("");
  const [rol, setRol] = useState("KATIP_PERSONEL");
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await window.api.kullaniciYonetimList());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  async function ekle() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await window.api.kullaniciYonetimCreate({
        adSoyad,
        kullaniciAdi,
        sifre,
        rol,
      });
      if (!r.ok) {
        showToast("error", r.error);
        return;
      }
      setAdSoyad("");
      setKullaniciAdi("");
      setSifre("");
      showToast("success", "Kullanıcı eklendi.");
      await yukle();
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSectionFrame
      title="Kullanıcılar"
      description="Alt kullanıcı ekleyin, rollerini yönetin, pasifleştirin veya şifre sıfırlayın. Büro sahibi tüm yetkilere sahiptir."
      loading={loading}
    >
      <div className="pm-users-create">
        <h3 className="pm-kalem-block-title">Yeni kullanıcı</h3>
        <div className="pm-settings-form-grid">
          <div className="pm-field">
            <label>Ad soyad</label>
            <input className="pm-input" value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} />
          </div>
          <div className="pm-field">
            <label>Kullanıcı adı</label>
            <input className="pm-input" value={kullaniciAdi} onChange={(e) => setKullaniciAdi(e.target.value)} />
          </div>
          <div className="pm-field">
            <label>Şifre</label>
            <input className="pm-input" type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} />
          </div>
          <div className="pm-field">
            <label>Rol</label>
            <select className="pm-input" value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="AVUKAT_YONETICI">{ROL_ETIKET.AVUKAT_YONETICI}</option>
              <option value="KATIP_PERSONEL">{ROL_ETIKET.KATIP_PERSONEL}</option>
              <option value="BURO_SAHIBI">{ROL_ETIKET.BURO_SAHIBI}</option>
            </select>
            <span className="pm-field-hint">{ROL_HINT[rol]}</span>
          </div>
        </div>
        <PremiumButton type="button" className="pm-btn--sm" disabled={busy} onClick={() => void ekle()}>
          Kullanıcı ekle
        </PremiumButton>
      </div>

      <div className="pm-users-list-block">
        <h3 className="pm-kalem-block-title">Kayıtlı kullanıcılar</h3>
        {rows.length === 0 ? (
          <p className="pm-muted">Henüz kullanıcı yok.</p>
        ) : (
          <ul className="pm-kalem-rows">
            {rows.map((u) => (
              <li key={u.id} className="pm-kalem-row pm-users-row">
                <div className="pm-users-row-main">
                  <strong className="pm-kalem-row-name">{u.adSoyad}</strong>
                  <span className="pm-muted">
                    @{u.kullaniciAdi}
                    {u.eposta ? ` · ${u.eposta}` : ""}
                    {u.telefon ? ` · ${u.telefon}` : ""}
                  </span>
                  <div className="pm-users-badges">
                    <span className="pm-users-role-badge">{ROL_ETIKET[u.rol] ?? u.rol}</span>
                    <span className={`pm-users-status ${u.aktifMi ? "pm-users-status--aktif" : "pm-users-status--pasif"}`}>
                      {u.aktifMi ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                  <span className="pm-field-hint">{ROL_HINT[u.rol] ?? ""}</span>
                </div>
                <div className="pm-kalem-row-actions">
                  <button
                    type="button"
                    className="pm-btn pm-btn--sm pm-btn--ghost"
                    onClick={() =>
                      void window.api.kullaniciYonetimSetAktif(u.id, !u.aktifMi).then((r) => {
                        if (!r.ok) showToast("error", r.error);
                        else void yukle();
                      })
                    }
                  >
                    {u.aktifMi ? "Pasifleştir" : "Aktifleştir"}
                  </button>
                  <button
                    type="button"
                    className="pm-btn pm-btn--sm pm-btn--ghost"
                    onClick={() => {
                      const s = window.prompt("Yeni şifre (min 6 karakter)");
                      if (!s) return;
                      void window.api.kullaniciYonetimResetSifre(u.id, s).then((r) => {
                        if (!r.ok) showToast("error", r.error);
                        else showToast("success", "Şifre güncellendi.");
                      });
                    }}
                  >
                    Şifre sıfırla
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsSectionFrame>
  );
}
