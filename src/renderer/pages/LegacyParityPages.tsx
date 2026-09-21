import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DosyaListeSatir } from "@shared/types/dosyaListe";
import type { TahsilatMerkeziSatir } from "@shared/types/tahsilatMerkezi";
import type { Randevu } from "@shared/types/randevu";
import { formatDateTr, formatTry } from "../lib/format";

export function LegacyDosyalarPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<DosyaListeSatir[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    void (async () => {
      const r = await window.api.dosyaListAll({ q, page: 1, pageSize: 50 });
      setItems(r.items);
      setTotal(r.total);
    })();
  }, [q]);

  return (
    <div className="desk-page desk-page-shell">
      <header className="desk-app-page-header">
        <h1 className="desk-app-page-title">Dosyalar</h1>
        <span className="desk-panel-meta">{total} kayıt</span>
      </header>
      <input className="desk-input" placeholder="Ara…" value={q} onChange={(e) => setQ(e.target.value)} />
      <table className="desk-table desk-table--striped">
        <thead>
          <tr>
            <th>Konu</th>
            <th>Müvekkil</th>
            <th>Durum</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id}>
              <td>{d.konuBasligi ?? "—"}</td>
              <td>{d.muvekkilAd}</td>
              <td>{d.durum}</td>
              <td>
                <Link to={`/muvekkil/${d.muvekkilId}/dosya/${d.id}`}>Aç</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegacyTahsilatMerkeziPage() {
  const [items, setItems] = useState<TahsilatMerkeziSatir[]>([]);
  const [ozet, setOzet] = useState<{ gecikmisAdet: number; bugunAdet: number } | null>(null);

  useEffect(() => {
    void (async () => {
      const [o, list] = await Promise.all([
        window.api.tahsilatMerkeziOzet(),
        window.api.tahsilatMerkeziList({ gorunum: "GECIKENLER", page: 1, limit: 50 }),
      ]);
      setOzet(o);
      setItems(list.items);
    })();
  }, []);

  return (
    <div className="desk-page desk-page-shell">
      <header className="desk-app-page-header">
        <h1 className="desk-app-page-title">Tahsilat Merkezi</h1>
      </header>
      <p className="desk-muted-compact">
        Gecikmiş: {ozet?.gecikmisAdet ?? 0} · Bugün: {ozet?.bugunAdet ?? 0}
      </p>
      <table className="desk-table desk-table--striped">
        <thead>
          <tr>
            <th>Müvekkil</th>
            <th>Dosya</th>
            <th>Vade</th>
            <th className="desk-num">Kalan</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td>{r.muvekkilAd}</td>
              <td>{r.dosyaBaslik}</td>
              <td>{formatDateTr(r.vadeTarihi)}</td>
              <td className="desk-num">{formatTry(r.kalanTutar)}</td>
              <td>
                <Link to={`/muvekkil/${r.muvekkilId}/dosya/${r.dosyaId}`}>Dosya</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegacyRandevularPage() {
  const [items, setItems] = useState<Randevu[]>([]);

  const yukle = useCallback(async () => {
    const now = new Date();
    const bas = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const bit = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
    const list = await window.api.randevuList({ baslangic: bas, bitis: bit });
    setItems(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  return (
    <div className="desk-page desk-page-shell">
      <header className="desk-app-page-header">
        <h1 className="desk-app-page-title">Randevular</h1>
      </header>
      <table className="desk-table desk-table--striped">
        <thead>
          <tr>
            <th>Başlık</th>
            <th>Başlangıç</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td>{r.baslik}</td>
              <td>{formatDateTr(r.baslangicAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegacyRaporlarPage() {
  return (
    <div className="desk-page desk-page-shell">
      <header className="desk-app-page-header">
        <h1 className="desk-app-page-title">Raporlar</h1>
      </header>
      <ul>
        <li>
          <Link to="/print/ofis-kasa-raporu">Ofis kasası raporu</Link>
        </li>
        <li>
          <Link to="/print/icra-tahsilat-raporu">İcra tahsilat raporu</Link>
        </li>
        <li>
          <Link to="/ofis-kasasi">Ofis kasası</Link>
        </li>
        <li>
          <Link to="/icra-tahsilat">İcra tahsilat</Link>
        </li>
      </ul>
      <p className="desk-muted-compact">Hesap özeti ve makbuzlar dosya detayından yazdırılır.</p>
    </div>
  );
}

export function LegacySettingsKullanicilar() {
  const [rows, setRows] = useState<
    { id: number; adSoyad: string; kullaniciAdi: string; rol: string; aktifMi: boolean }[]
  >([]);
  const [adSoyad, setAdSoyad] = useState("");
  const [kullaniciAdi, setKullaniciAdi] = useState("");
  const [sifre, setSifre] = useState("");
  const [mesaj, setMesaj] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setRows(await window.api.kullaniciYonetimList());
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  return (
    <section id="kullanicilar" className="section-card desk-panel desk-office-settings-panel">
      <div className="desk-panel-head">
        <span>Kullanıcılar</span>
      </div>
      <div className="desk-panel-body desk-panel-body--pad-sm">
        <div className="desk-form-grid">
          <div className="field">
            <label>Ad soyad</label>
            <input className="desk-input" value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} />
          </div>
          <div className="field">
            <label>Kullanıcı adı</label>
            <input className="desk-input" value={kullaniciAdi} onChange={(e) => setKullaniciAdi(e.target.value)} />
          </div>
          <div className="field">
            <label>Şifre</label>
            <input className="desk-input" type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} />
          </div>
          <div className="field">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                void window.api
                  .kullaniciYonetimCreate({ adSoyad, kullaniciAdi, sifre, rol: "KATIP_PERSONEL" })
                  .then((r) => {
                    setMesaj(r.ok ? "Eklendi" : r.error);
                    if (r.ok) {
                      setAdSoyad("");
                      setKullaniciAdi("");
                      setSifre("");
                      void yukle();
                    }
                  })
              }
            >
              Ekle
            </button>
          </div>
        </div>
        {mesaj ? <p className="desk-muted-compact">{mesaj}</p> : null}
        <ul>
          {rows.map((u) => (
            <li key={u.id}>
              {u.adSoyad} ({u.kullaniciAdi}) — {u.rol} {u.aktifMi ? "" : "(pasif)"}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function LegacySettingsDenetim() {
  const [rows, setRows] = useState<{ id: number; olusturmaTarihi: string; kullaniciAdi: string | null; eylem: string; ozet: string | null }[]>(
    [],
  );

  useEffect(() => {
    void window.api.auditList({ limit: 50, offset: 0 }).then((r) => setRows(r.rows as typeof rows));
  }, []);

  return (
    <section id="denetim" className="section-card desk-panel desk-office-settings-panel">
      <div className="desk-panel-head">
        <span>Denetim Kayıtları</span>
      </div>
      <div className="desk-panel-body desk-panel-body--pad-sm">
        <table className="desk-table desk-table--striped">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Kullanıcı</th>
              <th>Eylem</th>
              <th>Özet</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDateTr(r.olusturmaTarihi.slice(0, 10))}</td>
                <td>{r.kullaniciAdi ?? "—"}</td>
                <td>{r.eylem}</td>
                <td>{r.ozet ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
