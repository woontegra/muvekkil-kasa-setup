import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Dosya } from "@shared/types/dosya";
import type { Muvekkil, MuvekkilInput } from "@shared/types/muvekkil";
import { DosyaFormModal } from "../components/DosyaFormModal";
import { MuvekkilFormModal } from "../components/MuvekkilFormModal";
import { dosyaDurumEtiket } from "../lib/dosya";
import { muvekkilGorunenAd } from "../lib/muvekkil";

export function MuvekkilDetailPage() {
  const { id } = useParams();
  const mid = Number(id);
  const [m, setM] = useState<Muvekkil | null>(null);
  const [dosyalar, setDosyalar] = useState<Dosya[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [dosyaOpen, setDosyaOpen] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [dosyaErr, setDosyaErr] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [dosyaSaving, setDosyaSaving] = useState(false);

  const yukle = useCallback(async () => {
    if (!window.api || !Number.isFinite(mid)) return;
    const mu = await window.api.muvekkilGet(mid);
    setM(mu);
    const list = await window.api.dosyaList(mid);
    setDosyalar(list);
  }, [mid]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  async function kaydetMuvekkil(input: MuvekkilInput) {
    if (!window.api) return;
    setEditErr(null);
    setEditSaving(true);
    try {
      await window.api.muvekkilGuncelle(mid, input);
      setEditOpen(false);
      void yukle();
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : "Kayıt güncellenemedi.");
      throw e;
    } finally {
      setEditSaving(false);
    }
  }

  async function yeniDosyaKaydet(input: Parameters<typeof window.api.dosyaEkle>[0]) {
    setDosyaErr(null);
    if (!window.api?.dosyaEkle) {
      setDosyaErr("Dosya kaydedilemedi.");
      return;
    }
    setDosyaSaving(true);
    try {
      await window.api.dosyaEkle(input);
      setDosyaOpen(false);
      void yukle();
    } catch (e) {
      setDosyaErr(e instanceof Error ? e.message : "Dosya kaydedilemedi.");
      throw e;
    } finally {
      setDosyaSaving(false);
    }
  }

  if (!Number.isFinite(mid)) {
    return <p className="muted">Geçersiz müvekkil.</p>;
  }
  if (!m) {
    return <p className="muted">Yükleniyor veya kayıt yok…</p>;
  }

  return (
    <div className="desk-page desk-page-shell">
      <div className="desk-toolbar desk-toolbar--tight">
        <div className="desk-toolbar-left">
          <Link className="desk-link-back" to="/">
            ← Ana sayfa
          </Link>
          <span className="desk-toolbar-title">{muvekkilGorunenAd(m)}</span>
        </div>
        <div className="desk-toolbar-actions">
          <button type="button" className="btn btn-sm" onClick={() => setEditOpen(true)}>
            Düzenle
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setDosyaOpen(true)}>
            + Yeni dosya
          </button>
        </div>
      </div>

      <div className="desk-split desk-split--muvekkil-detail">
        <div className="desk-panel desk-panel--mvk-info">
          <div className="desk-panel-head">Müvekkil bilgisi</div>
          <div className="desk-panel-body desk-panel-body--mvk-info">
            <table className="desk-info-table desk-info-table--mvk-panel">
              <tbody>
                <tr>
                  <th>Tür</th>
                  <td>{m.muvekkilTuru === "TUZEL_KISI" ? "Tüzel kişi" : "Gerçek kişi"}</td>
                </tr>
                {m.muvekkilTuru === "GERCEK_KISI" ? (
                  <>
                    <tr>
                      <th>Ad soyad</th>
                      <td>
                        <strong>{m.adSoyad}</strong>
                      </td>
                    </tr>
                    <tr>
                      <th>Telefon</th>
                      <td>{m.telefon ?? "—"}</td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr>
                      <th>Şirket ünvanı</th>
                      <td>
                        <strong>{(m.sirketUnvani ?? "").trim() || "—"}</strong>
                      </td>
                    </tr>
                    <tr>
                      <th>Yetkili adı</th>
                      <td>{(m.yetkiliAdSoyad ?? "").trim() || "—"}</td>
                    </tr>
                    <tr>
                      <th>Müdür adı</th>
                      <td>{(m.mudurAdSoyad ?? "").trim() || "—"}</td>
                    </tr>
                    <tr>
                      <th>Muhasebe adı</th>
                      <td>{(m.muhasebeAdSoyad ?? "").trim() || "—"}</td>
                    </tr>
                    <tr>
                      <th>Vergi no</th>
                      <td>{(m.vergiNo ?? "").trim() || "—"}</td>
                    </tr>
                    <tr>
                      <th>Vergi dairesi</th>
                      <td>{(m.vergiDairesi ?? "").trim() || "—"}</td>
                    </tr>
                  </>
                )}
                <tr>
                  <th>E-posta</th>
                  <td>{(m.eposta ?? "").trim() || "—"}</td>
                </tr>
                <tr>
                  <th>Adres</th>
                  <td>{(m.adres ?? "").trim() || "—"}</td>
                </tr>
                <tr>
                  <th>Not</th>
                  <td>{m.not ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="desk-panel desk-panel--grow">
          <div className="desk-panel-head">
            <span>Dosyalar</span>
            <span className="desk-panel-meta">{dosyalar.length} dosya</span>
          </div>
          <div className="desk-panel-body desk-table-wrap" style={{ maxHeight: "min(62vh, 520px)" }}>
            {dosyalar.length === 0 ? (
              <p className="desk-muted-compact">
                Henüz dosya yok. <strong>+ Yeni dosya</strong> ile ekleyin.
              </p>
            ) : (
              <table className="desk-table desk-table--striped">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th>Dosya konusu</th>
                    <th>Mahkeme / icra</th>
                    <th>Dosya no</th>
                    <th>Durum</th>
                    <th style={{ width: "88px" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {dosyalar.map((d) => (
                    <tr key={d.id}>
                      <td>{d.id}</td>
                      <td>{(d.konuBasligi ?? "").trim() || "—"}</td>
                      <td>{(d.mahkemeAdi ?? "").trim() || "—"}</td>
                      <td>{(d.dosyaNumarasi ?? "").trim() || "—"}</td>
                      <td>{dosyaDurumEtiket(d.durum)}</td>
                      <td>
                        <Link to={`/muvekkil/${mid}/dosya/${d.id}`} className="btn btn-sm btn-primary">
                          Detay
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <MuvekkilFormModal
        title="Müvekkili düzenle"
        open={editOpen}
        saving={editSaving}
        error={editErr}
        initial={m}
        onClose={() => !editSaving && setEditOpen(false)}
        onSave={kaydetMuvekkil}
      />

      <DosyaFormModal
        title="Yeni dosya"
        open={dosyaOpen}
        saving={dosyaSaving}
        error={dosyaErr}
        muvekkilId={mid}
        onClose={() => !dosyaSaving && setDosyaOpen(false)}
        onSave={yeniDosyaKaydet}
      />
    </div>
  );
}
