import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GUVENLIK_SORULARI, GUVENLIK_SORU_KODLARI } from "@shared/types/auth";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";
import type { OfficeSettings } from "@shared/types/office";
import type { LicenseState } from "@shared/types/license";
import { desktopLicenseActionCta, desktopLicenseKindLabel } from "@shared/lib/licenseExpiry";
import { useLicenseStatus } from "../../hooks/useLicenseStatus";
import { LegacySettingsKalemleri } from "../../components/settings/LegacySettingsKalemleri";
import { LegacySettingsDenetim, LegacySettingsKullanicilar } from "../LegacyParityPages";
import programLogo from "../../assets/logo-M6Wo_PDM.png";
import woontegraLogo from "../../assets/woontegra-logo-C922wZYn.png";

function officeLicenseStatusLabel(state: LicenseState | null): string {
  if (!state) return "—";
  if (state.locked) return state.isExpired ? "Süresi doldu" : "Kilitli";
  if (!state.valid) return "Geçersiz";
  if (state.offlineDegraded) return "Çevrimdışı (geçerli)";
  return "Aktif";
}

function bosForm(): {
  ofisAdi: string;
  avukatAdiSoyadi: string;
  telefon: string;
  eposta: string;
  vergiNo: string;
  vergiDairesi: string;
  baroAdi: string;
  baroSicilNo: string;
  adres: string;
  logoPath: string | null;
} {
  return {
    ofisAdi: "",
    avukatAdiSoyadi: "",
    telefon: "",
    eposta: "",
    vergiNo: "",
    vergiDairesi: "",
    baroAdi: "",
    baroSicilNo: "",
    adres: "",
    logoPath: null,
  };
}

function formFromRow(row: OfficeSettings) {
  return {
    ofisAdi: row.ofisAdi ?? "",
    avukatAdiSoyadi: row.avukatAdiSoyadi ?? "",
    telefon: row.telefon ?? "",
    eposta: row.eposta ?? "",
    vergiNo: row.vergiNo ?? "",
    vergiDairesi: row.vergiDairesi ?? "",
    baroAdi: row.baroAdi ?? "",
    baroSicilNo: row.baroSicilNo ?? "",
    adres: row.adres ?? "",
    logoPath: row.logoPath,
  };
}

export function OfficeSettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state: licenseState, loading: licenseLoading, checkLicense, openRenewal } = useLicenseStatus();
  const [surum, setSurum] = useState("0.1.0");
  const [form, setForm] = useState(bosForm());
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [kayitMesaj, setKayitMesaj] = useState<{ tip: "ok" | "err"; metin: string } | null>(null);

  const [donemMode, setDonemMode] = useState<AccountingPeriodMode>("YEARLY");
  const [donemKaydediyor, setDonemKaydediyor] = useState(false);
  const [donemMesaj, setDonemMesaj] = useState<{ tip: "ok" | "err"; metin: string } | null>(null);

  const [mevcutSifre, setMevcutSifre] = useState("");
  const [yeniSifre, setYeniSifre] = useState("");
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState("");
  const [sifreKaydediyor, setSifreKaydediyor] = useState(false);
  const [sifreMesaj, setSifreMesaj] = useState<{ tip: "ok" | "err"; metin: string } | null>(null);

  const [guvenlikMevcutSifre, setGuvenlikMevcutSifre] = useState("");
  const [guvenlikSorusuKodu, setGuvenlikSorusuKodu] = useState("G1");
  const [guvenlikCevabi, setGuvenlikCevabi] = useState("");
  const [guvenlikKaydediyor, setGuvenlikKaydediyor] = useState(false);
  const [guvenlikMesaj, setGuvenlikMesaj] = useState<{ tip: "ok" | "err"; metin: string } | null>(null);

  const [backupMesaj, setBackupMesaj] = useState<{ tip: "ok" | "err"; metin: string } | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [updateCheckBusy, setUpdateCheckBusy] = useState(false);
  const [updateCheckMesaj, setUpdateCheckMesaj] = useState<{ tip: "ok" | "err"; metin: string } | null>(null);
  const [lisansKontrolBusy, setLisansKontrolBusy] = useState(false);
  const [lisansMesaj, setLisansMesaj] = useState<{ tip: "ok" | "err"; metin: string } | null>(null);

  const yukleLogoOnizleme = useCallback(async (path: string | null) => {
    const p = (path ?? "").trim();
    if (!p) {
      setLogoSrc(null);
      return;
    }
    try {
      const url = await window.api.officeLogoDataUrl(p);
      setLogoSrc(url);
    } catch {
      setLogoSrc(null);
    }
  }, []);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setKayitMesaj(null);
    try {
      const [row, ver, guv, mode] = await Promise.all([
        window.api.officeGet(),
        window.api.getAppVersion(),
        window.api.authGuvenlikBilgisi(),
        window.api.getAccountingPeriodMode?.() ?? Promise.resolve("YEARLY" as AccountingPeriodMode),
      ]);
      setSurum(ver || "0.1.0");
      setDonemMode(mode === "MONTHLY" ? "MONTHLY" : "YEARLY");
      const f = formFromRow(row);
      setForm(f);
      await yukleLogoOnizleme(f.logoPath);
      if (guv.ok && guv.guvenlikSorusuKodu && GUVENLIK_SORU_KODLARI.includes(guv.guvenlikSorusuKodu)) {
        setGuvenlikSorusuKodu(guv.guvenlikSorusuKodu);
      }
    } catch (e) {
      console.error("[officeGet]", e);
    } finally {
      setYukleniyor(false);
    }
  }, [yukleLogoOnizleme]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  useEffect(() => {
    const onPeriodChanged = () => {
      void (async () => {
        try {
          const m = await window.api.getAccountingPeriodMode?.();
          setDonemMode(m === "MONTHLY" ? "MONTHLY" : "YEARLY");
        } catch {
          /* ignore */
        }
      })();
    };
    window.addEventListener("mkd:accounting-period-changed", onPeriodChanged);
    return () => window.removeEventListener("mkd:accounting-period-changed", onPeriodChanged);
  }, []);

  useEffect(() => {
    if (yukleniyor) return;
    if (location.hash !== "#hesap-donemi") return;
    const el = document.getElementById("hesap-donemi");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, yukleniyor]);

  async function donemKaydet() {
    if (donemKaydediyor) return;
    setDonemKaydediyor(true);
    setDonemMesaj(null);
    try {
      const saved = await window.api.setAccountingPeriodMode(donemMode);
      setDonemMode(saved === "MONTHLY" ? "MONTHLY" : "YEARLY");
      setDonemMesaj({ tip: "ok", metin: "Hesap dönemi kaydedildi." });
      window.dispatchEvent(new CustomEvent("mkd:accounting-period-changed"));
    } catch (e) {
      console.error("[setAccountingPeriodMode]", e);
      setDonemMesaj({ tip: "err", metin: "Hesap dönemi kaydedilemedi." });
    } finally {
      setDonemKaydediyor(false);
    }
  }

  function alanDegistir<K extends keyof typeof form>(alan: K, deger: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [alan]: deger }));
    setKayitMesaj(null);
  }

  async function kaydet() {
    setKaydediyor(true);
    setKayitMesaj(null);
    try {
      const r = await window.api.officeSave({
        ofisAdi: form.ofisAdi,
        avukatAdiSoyadi: form.avukatAdiSoyadi,
        telefon: form.telefon,
        eposta: form.eposta,
        vergiNo: form.vergiNo,
        vergiDairesi: form.vergiDairesi,
        baroAdi: form.baroAdi,
        baroSicilNo: form.baroSicilNo,
        adres: form.adres,
        logoPath: form.logoPath,
      });
      if (!r.ok) {
        setKayitMesaj({ tip: "err", metin: r.error });
        return;
      }
      const f = formFromRow(r.row);
      setForm(f);
      await yukleLogoOnizleme(f.logoPath);
      setKayitMesaj({ tip: "ok", metin: "Ofis bilgileri kaydedildi." });
    } catch (e) {
      console.error("[officeSave]", e);
      setKayitMesaj({ tip: "err", metin: "Kayıt sırasında hata oluştu." });
    } finally {
      setKaydediyor(false);
    }
  }

  async function logoSec() {
    setKayitMesaj(null);
    try {
      const r = await window.api.officePickLogo();
      if (!r.ok) {
        if (!r.error.includes("iptal")) {
          setKayitMesaj({ tip: "err", metin: r.error });
        }
        return;
      }
      alanDegistir("logoPath", r.path);
      await yukleLogoOnizleme(r.path);
    } catch (e) {
      console.error("[officePickLogo]", e);
      setKayitMesaj({ tip: "err", metin: "Logo seçilemedi." });
    }
  }

  async function sifreGuncelle() {
    setSifreKaydediyor(true);
    setSifreMesaj(null);
    if (!yeniSifre.trim()) {
      setSifreMesaj({ tip: "err", metin: "Yeni şifre boş olamaz." });
      setSifreKaydediyor(false);
      return;
    }
    if (yeniSifre !== yeniSifreTekrar) {
      setSifreMesaj({ tip: "err", metin: "Yeni şifre ve tekrarı aynı değil." });
      setSifreKaydediyor(false);
      return;
    }
    try {
      const r = await window.api.authSifreGuncelle({
        mevcutSifre,
        yeniSifre,
      });
      if (!r.ok) {
        setSifreMesaj({ tip: "err", metin: r.error });
        return;
      }
      setMevcutSifre("");
      setYeniSifre("");
      setYeniSifreTekrar("");
      setSifreMesaj({ tip: "ok", metin: "Şifreniz güncellendi." });
    } catch (e) {
      console.error("[authSifreGuncelle]", e);
      setSifreMesaj({ tip: "err", metin: "Şifre güncellenemedi." });
    } finally {
      setSifreKaydediyor(false);
    }
  }

  async function guvenlikGuncelle() {
    setGuvenlikKaydediyor(true);
    setGuvenlikMesaj(null);
    try {
      const r = await window.api.authGuvenlikGuncelle({
        mevcutSifre: guvenlikMevcutSifre,
        guvenlikSorusuKodu,
        guvenlikCevabi,
      });
      if (!r.ok) {
        setGuvenlikMesaj({ tip: "err", metin: r.error });
        return;
      }
      setGuvenlikMevcutSifre("");
      setGuvenlikCevabi("");
      setGuvenlikMesaj({ tip: "ok", metin: "Güvenlik bilgileri güncellendi." });
    } catch (e) {
      console.error("[authGuvenlikGuncelle]", e);
      setGuvenlikMesaj({ tip: "err", metin: "Güvenlik güncellenemedi." });
    } finally {
      setGuvenlikKaydediyor(false);
    }
  }

  async function lisansKontrol() {
    if (lisansKontrolBusy) return;
    setLisansKontrolBusy(true);
    setLisansMesaj(null);
    try {
      const r = await checkLicense();
      if (r.ok) {
        setLisansMesaj({ tip: "ok", metin: "Lisans durumu güncellendi." });
      } else {
        setLisansMesaj({ tip: "err", metin: r.error?.trim() || "Lisans doğrulanamadı." });
      }
    } catch {
      setLisansMesaj({ tip: "err", metin: "Lisans doğrulanamadı." });
    } finally {
      setLisansKontrolBusy(false);
    }
  }

  async function yedekAl() {
    setBackupBusy(true);
    setBackupMesaj(null);
    try {
      const r = await window.api.backupAl();
      if (!r.ok) {
        if (!r.error.includes("iptal")) {
          setBackupMesaj({ tip: "err", metin: r.error });
        }
        return;
      }
      setBackupMesaj({ tip: "ok", metin: `Yedek alındı: ${r.path}` });
    } catch (e) {
      console.error("[backupAl]", e);
      setBackupMesaj({ tip: "err", metin: "Yedek alınamadı." });
    } finally {
      setBackupBusy(false);
    }
  }

  async function yedektenGeriYukle() {
    const onay = window.confirm(
      "Seçilen yedek dosyası mevcut veritabanının üzerine yazılacaktır.\n\n" +
        "İşlem öncesi mevcut veritabanının otomatik yedeği alınır.\n\n" +
        "Devam etmek istiyor musunuz?"
    );
    if (!onay) return;
    setBackupBusy(true);
    setBackupMesaj(null);
    try {
      const r = await window.api.backupGeriYukle();
      if (!r.ok) {
        if (!r.error.includes("iptal")) {
          setBackupMesaj({ tip: "err", metin: r.error });
        }
        return;
      }
      setBackupMesaj({
        tip: "ok",
        metin: `Geri yükleme tamamlandı. Önceki veritabanı yedeği: ${r.autoBackupPath}\n\nDeğişikliklerin tam yansıması için programı yeniden başlatmanız önerilir.`,
      });
      await yukle();
    } catch (e) {
      console.error("[backupGeriYukle]", e);
      setBackupMesaj({ tip: "err", metin: "Geri yükleme başarısız." });
    } finally {
      setBackupBusy(false);
    }
  }

  const logoEtiket = (form.logoPath ?? "").trim()
    ? form.logoPath!.replace(/^.*[\\/]/, "")
    : "Seçilmedi";

  return (
    <div className="desk-page desk-page-shell desk-app-page desk-page--office-settings">
      <header className="desk-app-page-header">
        <div className="desk-app-page-header-main">
          <Link className="desk-app-page-back" to="/">
            ← Müvekkil Kasa
          </Link>
          <h1 className="desk-app-page-title">Ofis bilgileri</h1>
          <p className="desk-app-page-sub">
            Makbuz ve çıktılarda kullanılır. Ofis adı veya avukat adı soyadından en az biri zorunludur.
          </p>
        </div>
      </header>

      <LegacySettingsKalemleri />
      <LegacySettingsKullanicilar />
      <LegacySettingsDenetim />

      <section id="hesap-donemi" className="section-card desk-panel desk-office-settings-panel">
        <div className="desk-panel-head">
          <span>Hesap Dönemi Ayarları</span>
          <span className="desk-panel-meta">özet dönemleri</span>
        </div>
        <div className="desk-panel-body desk-panel-body--pad-sm">
          {donemMesaj ? (
            <div className={`desk-backup-notice desk-backup-notice--${donemMesaj.tip === "ok" ? "ok" : "err"}`}>
              {donemMesaj.metin}
            </div>
          ) : null}
          {yukleniyor ? (
            <p className="desk-muted-compact">Yükleniyor…</p>
          ) : (
            <>
              <p className="desk-muted-compact desk-office-settings-desc">
                Ana sayfadaki gelir, gider ve dönem sonucu hesaplarının hangi dönem üzerinden gösterileceğini belirler.
              </p>
              <div className="desk-hesap-donemi-radios" role="radiogroup" aria-label="Hesap dönemi tipi">
                <label className="desk-taksit-plani-radio desk-hesap-donemi-radio-block">
                  <input
                    type="radio"
                    name="hesap-donemi-mode"
                    checked={donemMode === "YEARLY"}
                    disabled={donemKaydediyor}
                    onChange={() => {
                      setDonemMode("YEARLY");
                      setDonemMesaj(null);
                    }}
                  />
                  <span>
                    <strong>Yıllık dönem</strong>
                    <small className="desk-muted-compact">
                      Her takvim yılında gelir ve gider hesapları sıfırdan başlar. Önceki yıldan kalan kasa tutarı
                      devreden bakiye olarak gösterilir.
                    </small>
                  </span>
                </label>
                <label className="desk-taksit-plani-radio desk-hesap-donemi-radio-block">
                  <input
                    type="radio"
                    name="hesap-donemi-mode"
                    checked={donemMode === "MONTHLY"}
                    disabled={donemKaydediyor}
                    onChange={() => {
                      setDonemMode("MONTHLY");
                      setDonemMesaj(null);
                    }}
                  />
                  <span>
                    <strong>Aylık dönem</strong>
                    <small className="desk-muted-compact">
                      Her ay gelir ve gider hesapları sıfırdan başlar. Önceki aydan kalan kasa tutarı devreden bakiye
                      olarak gösterilir.
                    </small>
                  </span>
                </label>
              </div>
              <div className="desk-office-settings-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={donemKaydediyor}
                  onClick={() => void donemKaydet()}
                >
                  {donemKaydediyor ? "Kaydediliyor…" : "Kaydet"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="section-card desk-panel desk-office-settings-panel">
        <div className="desk-panel-head">
          <span>Kurum ve iletişim</span>
          <span className="desk-panel-meta">kayıt</span>
        </div>
        <div className="desk-panel-body desk-panel-body--pad-sm">
          {kayitMesaj ? (
            <div className={`desk-backup-notice desk-backup-notice--${kayitMesaj.tip === "ok" ? "ok" : "err"}`}>
              {kayitMesaj.metin}
            </div>
          ) : null}

          {yukleniyor ? (
            <p className="desk-muted-compact">Yükleniyor…</p>
          ) : (
            <>
              <div className="desk-office-form-row desk-office-form-row--5">
                <div className="field">
                  <label htmlFor="ofis-adi">Ofis / firma adı</label>
                  <input
                    id="ofis-adi"
                    className="desk-input"
                    value={form.ofisAdi}
                    onChange={(e) => alanDegistir("ofisAdi", e.target.value)}
                    disabled={kaydediyor}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ofis-avukat">Avukat adı soyadı</label>
                  <input
                    id="ofis-avukat"
                    className="desk-input"
                    value={form.avukatAdiSoyadi}
                    onChange={(e) => alanDegistir("avukatAdiSoyadi", e.target.value)}
                    disabled={kaydediyor}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ofis-tel">Telefon</label>
                  <input
                    id="ofis-tel"
                    className="desk-input"
                    value={form.telefon}
                    onChange={(e) => alanDegistir("telefon", e.target.value)}
                    disabled={kaydediyor}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ofis-eposta">E-posta</label>
                  <input
                    id="ofis-eposta"
                    className="desk-input"
                    type="email"
                    value={form.eposta}
                    onChange={(e) => alanDegistir("eposta", e.target.value)}
                    disabled={kaydediyor}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ofis-vno">Vergi no</label>
                  <input
                    id="ofis-vno"
                    className="desk-input"
                    value={form.vergiNo}
                    onChange={(e) => alanDegistir("vergiNo", e.target.value)}
                    disabled={kaydediyor}
                  />
                </div>
              </div>
              <div className="desk-office-form-row desk-office-form-row--3">
                <div className="field">
                  <label htmlFor="ofis-vd">Vergi dairesi</label>
                  <input
                    id="ofis-vd"
                    className="desk-input"
                    value={form.vergiDairesi}
                    onChange={(e) => alanDegistir("vergiDairesi", e.target.value)}
                    disabled={kaydediyor}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ofis-baro">Baro adı</label>
                  <input
                    id="ofis-baro"
                    className="desk-input"
                    value={form.baroAdi}
                    onChange={(e) => alanDegistir("baroAdi", e.target.value)}
                    disabled={kaydediyor}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ofis-sicil">Baro sicil no</label>
                  <input
                    id="ofis-sicil"
                    className="desk-input"
                    value={form.baroSicilNo}
                    onChange={(e) => alanDegistir("baroSicilNo", e.target.value)}
                    disabled={kaydediyor}
                  />
                </div>
              </div>
              <div className="field desk-office-form-full">
                <label htmlFor="ofis-adres">Adres</label>
                <textarea
                  id="ofis-adres"
                  className="desk-input"
                  rows={2}
                  value={form.adres}
                  onChange={(e) => alanDegistir("adres", e.target.value)}
                  disabled={kaydediyor}
                />
              </div>
              <div className="desk-office-form-footer">
                <div className="field desk-office-form-footer-logo">
                  <label>Logo seç</label>
                  <div className="logo-row">
                    <button type="button" className="btn btn-sm" onClick={() => void logoSec()} disabled={kaydediyor}>
                      Logo seç
                    </button>
                    <span className="logo-path desk-muted-compact" title={form.logoPath ?? undefined}>
                      {logoEtiket}
                    </span>
                  </div>
                  {logoSrc ? (
                    <div className="logo-preview-wrap">
                      <img src={logoSrc} alt="Ofis logosu" className="logo-preview" />
                    </div>
                  ) : (
                    <p className="desk-muted-compact desk-office-logo-empty">Logo seçilmedi</p>
                  )}
                </div>
                <div className="desk-office-form-footer-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void kaydet()} disabled={kaydediyor}>
                    {kaydediyor ? "Kaydediliyor…" : "Kaydet"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="section-card desk-panel desk-office-settings-panel">
        <div className="desk-panel-head">
          <span>Güvenlik</span>
        </div>
        <div className="desk-panel-body desk-panel-body--pad-sm">
          {sifreMesaj ? (
            <div className={`desk-backup-notice desk-backup-notice--${sifreMesaj.tip === "ok" ? "ok" : "err"}`}>
              {sifreMesaj.metin}
            </div>
          ) : null}
          <div className="desk-office-guvenlik-block">
            <div className="desk-office-guvenlik-block-title">Şifre Değiştir</div>
            <div className="desk-office-form-row desk-office-form-row--guvenlik">
              <div className="field">
                <label htmlFor="sifre-mevcut">Mevcut şifre</label>
                <input
                  id="sifre-mevcut"
                  className="desk-input"
                  type="password"
                  autoComplete="current-password"
                  value={mevcutSifre}
                  onChange={(e) => setMevcutSifre(e.target.value)}
                  disabled={sifreKaydediyor}
                />
              </div>
              <div className="field">
                <label htmlFor="sifre-yeni">Yeni şifre</label>
                <input
                  id="sifre-yeni"
                  className="desk-input"
                  type="password"
                  autoComplete="new-password"
                  value={yeniSifre}
                  onChange={(e) => setYeniSifre(e.target.value)}
                  disabled={sifreKaydediyor}
                />
              </div>
              <div className="field">
                <label htmlFor="sifre-yeni-tekrar">Yeni şifre tekrar</label>
                <input
                  id="sifre-yeni-tekrar"
                  className="desk-input"
                  type="password"
                  autoComplete="new-password"
                  value={yeniSifreTekrar}
                  onChange={(e) => setYeniSifreTekrar(e.target.value)}
                  disabled={sifreKaydediyor}
                />
              </div>
            </div>
            <div className="desk-office-settings-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void sifreGuncelle()}
                disabled={sifreKaydediyor}
              >
                {sifreKaydediyor ? "Güncelleniyor…" : "Şifreyi güncelle"}
              </button>
            </div>
          </div>

          <div className="desk-office-guvenlik-block desk-office-guvenlik-block--alt">
            <div className="desk-office-guvenlik-block-title">Güvenlik Sorusu</div>
            {guvenlikMesaj ? (
              <div className={`desk-backup-notice desk-backup-notice--${guvenlikMesaj.tip === "ok" ? "ok" : "err"}`}>
                {guvenlikMesaj.metin}
              </div>
            ) : null}
            <div className="desk-office-form-row desk-office-form-row--guvenlik">
              <div className="field">
                <label htmlFor="guvenlik-sifre">Mevcut şifre</label>
                <input
                  id="guvenlik-sifre"
                  className="desk-input"
                  type="password"
                  autoComplete="current-password"
                  value={guvenlikMevcutSifre}
                  onChange={(e) => setGuvenlikMevcutSifre(e.target.value)}
                  disabled={guvenlikKaydediyor}
                />
              </div>
              <div className="field">
                <label htmlFor="guvenlik-soru">Yeni güvenlik sorusu</label>
                <select
                  id="guvenlik-soru"
                  className="desk-input"
                  value={guvenlikSorusuKodu}
                  onChange={(e) => setGuvenlikSorusuKodu(e.target.value)}
                  disabled={guvenlikKaydediyor}
                >
                  {GUVENLIK_SORU_KODLARI.map((k) => (
                    <option key={k} value={k}>
                      {GUVENLIK_SORULARI[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="guvenlik-cevap">Yeni güvenlik cevabı</label>
                <input
                  id="guvenlik-cevap"
                  className="desk-input"
                  value={guvenlikCevabi}
                  onChange={(e) => setGuvenlikCevabi(e.target.value)}
                  disabled={guvenlikKaydediyor}
                />
              </div>
            </div>
            <div className="desk-office-settings-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void guvenlikGuncelle()}
                disabled={guvenlikKaydediyor}
              >
                {guvenlikKaydediyor ? "Güncelleniyor…" : "Güvenliği güncelle"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section-card desk-panel desk-office-settings-panel desk-office-settings-panel--backup">
        <div className="desk-panel-head">
          <span>Yedekleme ve geri yükleme</span>
        </div>
        <div className="desk-panel-body desk-panel-body--pad-sm">
          <p className="desk-muted-compact desk-office-backup-desc">
            Yedekleme, programdaki müvekkil, dosya, kasa, makbuz, vekalet ve taksit kayıtlarını güvenli bir dosyaya
            kopyalar.
          </p>
          {backupMesaj ? (
            <div className={`desk-backup-notice desk-backup-notice--${backupMesaj.tip === "ok" ? "ok" : "err"}`}>
              {backupMesaj.metin}
            </div>
          ) : null}
          <div className="desk-office-settings-actions desk-office-backup-actions">
            <button type="button" className="btn btn-sm" onClick={() => void yedekAl()} disabled={backupBusy}>
              Yedek Al
            </button>
            <button type="button" className="btn btn-sm" onClick={() => void yedektenGeriYukle()} disabled={backupBusy}>
              Yedekten Geri Yükle
            </button>
          </div>
        </div>
      </section>

      <section className="section-card desk-panel desk-office-settings-panel">
        <div className="desk-panel-head">
          <span>Lisans</span>
        </div>
        <div className="desk-panel-body desk-panel-body--pad-sm">
          <p className="desk-muted-compact">
            {licenseState?.record?.kind === "trial"
              ? "Deneme lisansınızın süresini ve durumunu görüntüleyin."
              : "Lisans durumunuzu görüntüleyin ve yenileme işlemlerini yönetin."}
          </p>
          <p className="desk-about-app-meta">
            <span className="desk-about-label">Durum:</span> {officeLicenseStatusLabel(licenseState)}
          </p>
          <p className="desk-about-app-meta">
            <span className="desk-about-label">Lisans türü:</span>{" "}
            {desktopLicenseKindLabel(licenseState?.record?.kind) ?? "—"}
          </p>
          <p className="desk-about-app-meta">
            <span className="desk-about-label">Kalan gün:</span>{" "}
            {licenseState?.daysRemaining != null ? `${licenseState.daysRemaining} gün` : "—"}
          </p>
          <p className="desk-about-app-meta">
            <span className="desk-about-label">Son geçerlilik:</span>{" "}
            {licenseState?.expiryLabel?.trim() || licenseState?.expiresAt?.trim() || "—"}
          </p>
          <p className="desk-about-app-meta">
            <span className="desk-about-label">Cihaz durumu:</span>{" "}
            {licenseState?.record?.status === "ACTIVE"
              ? "Kayıtlı"
              : licenseState?.record?.status === "LOCKED"
                ? "Kilitli"
                : "—"}
          </p>
          {lisansMesaj ? (
            <div className={`desk-backup-notice desk-backup-notice--${lisansMesaj.tip === "ok" ? "ok" : "err"}`}>
              {lisansMesaj.metin}
            </div>
          ) : null}
          <div className="desk-office-settings-actions">
            <button
              type="button"
              className="btn btn-sm"
              disabled={lisansKontrolBusy || licenseLoading}
              onClick={() => void lisansKontrol()}
            >
              {lisansKontrolBusy ? "Kontrol ediliyor…" : "Lisansı kontrol et"}
            </button>
            {desktopLicenseActionCta(licenseState?.record?.kind) === "renew" ? (
              <button type="button" className="btn btn-sm" onClick={() => void openRenewal()}>
                Lisansı yenile
              </button>
            ) : null}
            {desktopLicenseActionCta(licenseState?.record?.kind) === "upgrade" ? (
              <button type="button" className="btn btn-sm" onClick={() => navigate("/lisans/yukselt")}>
                Tam Sürüme Geç
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section-card desk-panel desk-panel--about-app desk-office-settings-panel--about">
        <div className="desk-panel-head">
          <span>Uygulama hakkında</span>
          <span className="desk-panel-meta">Woontegra</span>
        </div>
        <div className="desk-panel-body desk-about-app-body">
          <div className="desk-about-app-main">
            <img src={programLogo} alt="" className="desk-office-app-logo" />
            <div className="desk-about-app-text">
              <h2 className="desk-about-app-name">Müvekkil Kasa Defteri</h2>
              <p className="desk-about-app-meta">
                <span className="desk-about-label">Geliştirici:</span> Woontegra
              </p>
              <p className="desk-about-app-meta">
                <span className="desk-about-label">Sürüm:</span> {surum}
              </p>
              <span className="desk-update-status-badge">Otomatik güncelleme: Etkin</span>
              <p className="desk-about-app-desc">
                Avukatlar için müvekkil bazlı avans, masraf ve vekalet takibi programı.
              </p>
              <div className="desk-about-update-actions">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={updateCheckBusy}
                  onClick={() => {
                    setUpdateCheckBusy(true);
                    setUpdateCheckMesaj(null);
                    void window.api
                      .updateCheck("manual")
                      .then((r) => {
                        if (!r.ok) {
                          setUpdateCheckMesaj({ tip: "err", metin: r.error });
                        }
                      })
                      .catch(() => {
                        setUpdateCheckMesaj({ tip: "err", metin: "Güncelleme kontrolü başarısız." });
                      })
                      .finally(() => setUpdateCheckBusy(false));
                  }}
                >
                  {updateCheckBusy ? "Kontrol ediliyor…" : "Güncellemeleri kontrol et"}
                </button>
              </div>
              {updateCheckMesaj ? (
                <p className={`desk-about-update-msg${updateCheckMesaj.tip === "err" ? " desk-about-update-msg--err" : ""}`}>
                  {updateCheckMesaj.metin}
                </p>
              ) : null}
            </div>
            <img src={woontegraLogo} alt="Woontegra" className="desk-about-woontegra-mark desk-about-woontegra-mark--settings" />
          </div>
        </div>
      </section>
    </div>
  );
}
