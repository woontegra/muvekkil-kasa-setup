import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { OdemeYontemiKodu } from "@shared/constants/kasa";
import type { KasaHareket, KasaOzet } from "@shared/types/kasa";
import { KasaAvansModal } from "./KasaAvansModal";
import { KasaDuzeltmeModal } from "./KasaDuzeltmeModal";
import { KasaMasrafModal } from "./KasaMasrafModal";
import { formatDateTr, formatTry } from "../lib/format";
import {
  hareketAciklamaMasraf,
  kasaHareketleriFiltrele,
  kasaHareketSatirSinifi,
  KasaListeFiltre,
  odemeEtiket,
  onayBadgeClass,
  onayBadgeMetni,
  tipEtiket,
} from "../lib/kasa";

type Props = {
  dosyaId: number;
  muvekkilId: number;
};

export function KasaHareketleriTab({ dosyaId, muvekkilId }: Props) {
  const navigate = useNavigate();
  const [ozet, setOzet] = useState<KasaOzet | null>(null);
  const [hareketler, setHareketler] = useState<KasaHareket[]>([]);
  const [masrafTurleri, setMasrafTurleri] = useState<string[]>([]);
  const [arama, setArama] = useState("");
  const [filtre, setFiltre] = useState<KasaListeFiltre>("tum");
  const [avansOpen, setAvansOpen] = useState(false);
  const [masrafOpen, setMasrafOpen] = useState(false);
  const [masrafEdit, setMasrafEdit] = useState<KasaHareket | null>(null);
  const [duzeltmeHedef, setDuzeltmeHedef] = useState<KasaHareket | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [duzeltmeErr, setDuzeltmeErr] = useState<string | null>(null);
  const [duzeltmeSaving, setDuzeltmeSaving] = useState(false);

  const yukle = useCallback(async () => {
    if (!window.api) return;
    const [o, h, m] = await Promise.all([
      window.api.kasaOzet(dosyaId),
      window.api.kasaList(dosyaId),
      window.api.masrafTurleri(),
    ]);
    setOzet(o);
    setHareketler(h);
    setMasrafTurleri(m);
  }, [dosyaId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const filtrelenmis = useMemo(() => kasaHareketleriFiltrele(hareketler, arama, filtre), [hareketler, arama, filtre]);

  async function kaydetAvans(data: {
    tarih: string;
    tutar: number;
    odemeYontemi: OdemeYontemiKodu;
    aciklama: string | null;
  }) {
    setFormErr(null);
    setSaving(true);
    try {
      const res = await window.api.kasaEkle({
        dosyaId,
        muvekkilId,
        islemTipi: "AVANS_GIRISI",
        tutar: data.tutar,
        tarih: data.tarih,
        odemeYontemi: data.odemeYontemi,
        aciklama: data.aciklama,
      });
      if (!res.ok) {
        setFormErr(res.error);
        throw new Error(res.error);
      }
      setAvansOpen(false);
      void yukle();
    } finally {
      setSaving(false);
    }
  }

  async function kaydetMasraf(data: {
    tarih: string;
    tutar: number;
    odemeYontemi: OdemeYontemiKodu;
    masrafTuru: string;
    aciklama: string | null;
  }) {
    setFormErr(null);
    setSaving(true);
    try {
      if (masrafEdit) {
        const res = await window.api.kasaGuncelle(masrafEdit.id, {
          tutar: data.tutar,
          tarih: data.tarih,
          masrafTuru: data.masrafTuru,
          odemeYontemi: data.odemeYontemi,
          aciklama: data.aciklama,
        });
        if (!res.ok) {
          setFormErr(res.error);
          throw new Error(res.error);
        }
      } else {
        const res = await window.api.kasaEkle({
          dosyaId,
          muvekkilId,
          islemTipi: "MASRAF",
          tutar: data.tutar,
          tarih: data.tarih,
          masrafTuru: data.masrafTuru,
          odemeYontemi: data.odemeYontemi,
          aciklama: data.aciklama,
        });
        if (!res.ok) {
          setFormErr(res.error);
          throw new Error(res.error);
        }
      }
      setMasrafOpen(false);
      setMasrafEdit(null);
      void yukle();
    } finally {
      setSaving(false);
    }
  }

  async function onaylaHareket(id: number) {
    if (!confirm("Bu işlemi onaylamak istediğinize emin misiniz? Onaylanan işlem silinemez.")) return;
    const r = await window.api.kasaOnayla(id);
    if (!r.ok) alert(r.error ?? "Onaylanamadı");
    void yukle();
  }

  async function reddetHareket(id: number) {
    if (!confirm("Bu işlemi reddetmek istediğinize emin misiniz?")) return;
    const r = await window.api.kasaGuncelle(id, { onayDurumu: "REDDEDILDI" });
    if (!r.ok) alert(r.error ?? "Reddedilemedi");
    void yukle();
  }

  async function silHareket(id: number) {
    if (!confirm("Bu işlemi silmek istediğinize emin misiniz?")) return;
    const r = await window.api.kasaSil(id);
    if (!r.ok) alert(r.error ?? "Silinemedi");
    void yukle();
  }

  async function kaydetDuzeltme(data: { tutar: number; tarih: string; aciklama: string }) {
    if (!duzeltmeHedef) return;
    setDuzeltmeErr(null);
    setDuzeltmeSaving(true);
    try {
      const res = await window.api.kasaEkle({
        dosyaId,
        muvekkilId,
        islemTipi: "DUZELTME",
        tutar: data.tutar,
        tarih: data.tarih,
        aciklama: data.aciklama,
        duzeltilenIslemId: duzeltmeHedef.id,
      });
      if (!res.ok) {
        setDuzeltmeErr(res.error);
        throw new Error(res.error);
      }
      setDuzeltmeHedef(null);
      void yukle();
    } finally {
      setDuzeltmeSaving(false);
    }
  }

  function makbuzGosterilebilir(h: KasaHareket): boolean {
    return (
      h.onayDurumu === "ONAYLI" &&
      (h.islemTipi === "AVANS_GIRISI" || h.islemTipi === "MASRAF" || h.islemTipi === "DUZELTME")
    );
  }

  async function makbuzAc(hid: number) {
    if (!window.api) return;
    const r = await window.api.makbuzYazdirmaPaketi(hid);
    if (!r.ok) {
      alert(r.mesaj ?? r.error ?? "Makbuz açılamadı");
      return;
    }
    navigate(`/print/makbuz/${hid}`);
  }

  function islemRowActions(h: KasaHareket) {
    if (h.onayDurumu === "ONAYSIZ") {
      return (
        <>
          {h.islemTipi === "MASRAF" ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setFormErr(null);
                setMasrafEdit(h);
                setMasrafOpen(true);
              }}
            >
              Düzenle
            </button>
          ) : null}
          <button type="button" className="btn btn-sm" onClick={() => void onaylaHareket(h.id)}>
            Onayla
          </button>
          <button type="button" className="btn btn-sm" onClick={() => void reddetHareket(h.id)}>
            Reddet
          </button>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => void silHareket(h.id)}>
            Sil
          </button>
        </>
      );
    }
    if (h.onayDurumu === "ONAYLI" && h.islemTipi !== "DUZELTME") {
      return (
        <>
          <button type="button" className="btn btn-sm" onClick={() => void makbuzAc(h.id)}>
            Makbuz
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setDuzeltmeHedef(h)}>
            Düzeltme ekle
          </button>
        </>
      );
    }
    if (h.onayDurumu === "ONAYLI" && h.islemTipi === "DUZELTME" && makbuzGosterilebilir(h)) {
      return (
        <button type="button" className="btn btn-sm" onClick={() => void makbuzAc(h.id)}>
          Makbuz
        </button>
      );
    }
    if (h.onayDurumu === "REDDEDILDI") {
      return (
        <button type="button" className="btn btn-sm btn-danger" onClick={() => void silHareket(h.id)}>
          Sil
        </button>
      );
    }
    return <span className="muted">—</span>;
  }

  function kasaTipHucre(h: KasaHareket) {
    const ana = h.islemTipi === "DUZELTME" ? "Düzeltme" : tipEtiket(h.islemTipi);
    return (
      <div className="desk-kasa-tip-cell">
        <span>{ana}</span>
        {!h.duzeltmeMi && h.hasCorrection ? (
          <span className="desk-badge-duzeltildi" title="Bu işlem için düzeltme kaydı var">
            Düzeltildi
          </span>
        ) : null}
      </div>
    );
  }

  const sonucMetni =
    filtrelenmis.length === 1 ? "1 kayıt bulundu" : `${filtrelenmis.length} kayıt bulundu`;

  return (
    <div className="desk-dosya-kasa-tab">
      <div className="desk-summary-bar">
        <div className="desk-metric desk-metric--accent-avans">
          <span className="l">Avans toplamı</span>
          <span className="v">{ozet ? formatTry(ozet.toplamAvans) : "—"}</span>
        </div>
        <div className="desk-metric desk-metric--accent-masraf">
          <span className="l">Masraf toplamı</span>
          <span className="v">{ozet ? formatTry(ozet.toplamMasraf) : "—"}</span>
        </div>
        <div className="desk-metric desk-metric--accent-kalan-avans">
          <span className="l">Kalan bakiye</span>
          <span className="v">{ozet ? formatTry(ozet.kalanAvans) : "—"}</span>
        </div>
        <div className="desk-metric desk-metric--accent-onay-bekleyen">
          <span className="l">Onay bekleyen</span>
          <span className="v">{ozet ? String(ozet.onayBekleyenSayisi) : "—"}</span>
        </div>
      </div>

      <div className="desk-toolbar desk-toolbar--tight desk-kasa-toolbar">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            setFormErr(null);
            setAvansOpen(true);
          }}
        >
          Avans girişi
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            setFormErr(null);
            setMasrafEdit(null);
            setMasrafOpen(true);
          }}
        >
          Masraf girişi
        </button>
      </div>

      <div className="desk-kasa-arama-bar">
        <div className="desk-field-inline" style={{ flex: "1 1 240px" }}>
          <label htmlFor="kasa-ara">Ara</label>
          <input
            id="kasa-ara"
            className="desk-input"
            placeholder="Belge no, açıklama, tutar, tarih veya ödeme yöntemi ara..."
            value={arama}
            onChange={(e) => setArama(e.target.value)}
          />
        </div>
        <div className="desk-field-inline">
          <label htmlFor="kasa-filtre">Filtre</label>
          <select id="kasa-filtre" className="desk-input desk-input--tiny" value={filtre} onChange={(e) => setFiltre(e.target.value as KasaListeFiltre)}>
            <option value="tum">Tüm hareketler</option>
            <option value="avans">Avans girişleri</option>
            <option value="masraf">Masraf girişleri</option>
            <option value="onaysiz">Onaysızlar</option>
            <option value="onayli">Onaylananlar</option>
            <option value="reddedilen">Reddedilenler</option>
          </select>
        </div>
        <span className="desk-kasa-sonuc-meta">{sonucMetni}</span>
      </div>

      <div className="desk-panel-body desk-table-wrap desk-kasa-table-wrap">
        {filtrelenmis.length === 0 ? (
          <p className="desk-muted-compact">
            {hareketler.length === 0 ? "Henüz hareket yok. Avans veya masraf girişi yapın." : "Aramanıza uygun kasa hareketi bulunamadı."}
          </p>
        ) : (
          <table className="desk-table desk-table--striped desk-table--compact">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Belge no</th>
                <th>Tip</th>
                <th>Açıklama / Masraf</th>
                <th>Ödeme</th>
                <th>Onay</th>
                <th className="desk-num">Tutar</th>
                <th style={{ minWidth: "140px" }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtrelenmis.map((h) => (
                <tr key={h.id} className={kasaHareketSatirSinifi(h)}>
                  <td>{formatDateTr(h.tarih)}</td>
                  <td>{h.belgeNo?.trim() || "—"}</td>
                  <td>{kasaTipHucre(h)}</td>
                  <td className={h.duzeltmeMi ? "desk-kasa-aciklama-correction" : undefined}>{hareketAciklamaMasraf(h)}</td>
                  <td>{h.islemTipi === "DUZELTME" ? "—" : odemeEtiket(h.odemeYontemi)}</td>
                  <td>
                    <span className={`badge ${onayBadgeClass(h)}`}>{onayBadgeMetni(h)}</span>
                  </td>
                  <td className="desk-num">{formatTry(h.tutar)}</td>
                  <td>
                    <div className="row-actions">{islemRowActions(h)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="desk-muted-compact desk-kasa-footnote">
        Onaysız satırlar kasa toplamlarına dahildir. Onaylı işlem silinemez; hata için düzeltme kaydı girin.
      </p>

      <KasaAvansModal
        open={avansOpen}
        saving={saving}
        error={formErr}
        onClose={() => !saving && setAvansOpen(false)}
        onSave={kaydetAvans}
      />

      <KasaMasrafModal
        open={masrafOpen}
        saving={saving}
        error={formErr}
        masrafTurleri={masrafTurleri}
        editHareket={masrafEdit}
        onClose={() => {
          if (saving) return;
          setMasrafOpen(false);
          setMasrafEdit(null);
        }}
        onSave={kaydetMasraf}
      />

      <KasaDuzeltmeModal
        hedef={duzeltmeHedef}
        saving={duzeltmeSaving}
        error={duzeltmeErr}
        onClose={() => !duzeltmeSaving && setDuzeltmeHedef(null)}
        onSave={kaydetDuzeltme}
      />
    </div>
  );
}
