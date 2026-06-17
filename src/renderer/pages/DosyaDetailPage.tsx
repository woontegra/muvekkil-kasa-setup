import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Dosya, DosyaUpdateInput } from "@shared/types/dosya";
import type { Muvekkil } from "@shared/types/muvekkil";
import type { SmmBekleyenSatir } from "@shared/types/vekalet";
import { DosyaFormModal } from "../components/DosyaFormModal";
import { IslemEkleSecimModal } from "../components/IslemEkleSecimModal";
import {
  DosyaKasaHareketleriPanel,
  DosyaKasaModals,
  DosyaMasraflarPanel,
} from "../components/DosyaKasaPanels";
import { VekaletTaksitlerTab } from "../components/VekaletTaksitlerTab";
import { useDosyaKasa } from "../hooks/useDosyaKasa";
import { formatTry } from "../lib/format";
import { muvekkilGorunenAd } from "../lib/muvekkil";
import { vekaletOzetFromTaksitler } from "../lib/vekalet";

export function DosyaDetailPage() {
  const { muvekkilId, dosyaId } = useParams();
  const mid = Number(muvekkilId);
  const did = Number(dosyaId);
  const [muvekkil, setMuvekkil] = useState<Muvekkil | null>(null);
  const [dosya, setDosya] = useState<Dosya | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [islemSecimOpen, setIslemSecimOpen] = useState(false);
  const [smmBekleyen, setSmmBekleyen] = useState<SmmBekleyenSatir[]>([]);
  const [taksitSayisi, setTaksitSayisi] = useState(0);
  const [vekaletAnlasilan, setVekaletAnlasilan] = useState(0);
  const [vekaletOdenen, setVekaletOdenen] = useState(0);

  const kasa = useDosyaKasa(did, mid);

  const yukleSmm = useCallback(async () => {
    if (!window.api || !Number.isFinite(did)) return;
    const list = await window.api.vekaletSmmBekleyenler(did);
    setSmmBekleyen(list);
  }, [did]);

  const yukleVekaletOzet = useCallback(async () => {
    if (!window.api || !Number.isFinite(did) || !Number.isFinite(mid)) return;
    const v = await window.api.vekaletGetOrCreate(did, mid);
    const t = await window.api.vekaletTaksitList(v.id);
    const oz = vekaletOzetFromTaksitler(v.anlasilanTutar, t);
    setVekaletAnlasilan(oz.anlasilanTutar);
    setVekaletOdenen(oz.odenenToplam);
    setTaksitSayisi(t.length);
  }, [did, mid]);

  const yukle = useCallback(async () => {
    if (!window.api || !Number.isFinite(mid) || !Number.isFinite(did)) return;
    const [mu, d] = await Promise.all([window.api.muvekkilGet(mid), window.api.dosyaGet(did)]);
    setMuvekkil(mu);
    setDosya(d);
    void yukleSmm();
    void yukleVekaletOzet();
  }, [mid, did, yukleSmm, yukleVekaletOzet]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const vekaletKalan = useMemo(
    () => Math.max(0, vekaletAnlasilan - vekaletOdenen),
    [vekaletAnlasilan, vekaletOdenen]
  );

  async function kaydetDosya(input: DosyaUpdateInput) {
    if (!window.api) return;
    setEditErr(null);
    setEditSaving(true);
    try {
      await window.api.dosyaGuncelle(did, input);
      setEditOpen(false);
      void yukle();
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : "Dosya güncellenemedi.");
      throw e;
    } finally {
      setEditSaving(false);
    }
  }

  function hesapOzetiYazdir() {
    alert("Hesap özeti yazdırma bu sürümde henüz bağlanmadı.");
  }

  function vekaletDegisti() {
    void yukleSmm();
    void yukleVekaletOzet();
    void kasa.yukle();
  }

  if (!Number.isFinite(did) || !Number.isFinite(mid)) {
    return <p className="muted">Geçersiz adres.</p>;
  }
  if (!dosya) {
    return <p className="muted">Yükleniyor…</p>;
  }

  const baslikKonu = (dosya.konuBasligi ?? "").trim() || "Dosya";
  const mAd = muvekkil ? muvekkilGorunenAd(muvekkil) : "—";
  const taksitMeta = taksitSayisi === 1 ? "1 taksit" : `${taksitSayisi} taksit`;

  return (
    <div className="desk-page desk-page--dosya-detail">
      <div className="desk-toolbar desk-toolbar--tight">
        <div className="desk-toolbar-left">
          <Link className="desk-link-back" to={`/muvekkil/${mid}`}>
            ← Müvekkile dön
          </Link>
          <span className="desk-toolbar-title" title={`${mAd} — ${baslikKonu}`}>
            {mAd} · {baslikKonu}
          </span>
        </div>
        <div className="desk-toolbar-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setIslemSecimOpen(true)}>
            + İşlem ekle
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setEditOpen(true)}>
            Dosyayı düzenle
          </button>
          <button type="button" className="btn btn-sm" onClick={hesapOzetiYazdir}>
            Hesap Özeti Yazdır
          </button>
        </div>
      </div>

      <div className="desk-file-strip">
        <div className="desk-file-kvgrid">
          <div className="desk-kv">
            <span className="desk-kv-k">Müvekkil</span>
            <span className="desk-kv-v">{mAd}</span>
          </div>
          <div className="desk-kv">
            <span className="desk-kv-k">Konu</span>
            <span className="desk-kv-v">{(dosya.konuBasligi ?? "").trim() || "—"}</span>
          </div>
          <div className="desk-kv">
            <span className="desk-kv-k">Mahkeme / İcra</span>
            <span className="desk-kv-v">{(dosya.mahkemeAdi ?? "").trim() || "—"}</span>
          </div>
          <div className="desk-kv">
            <span className="desk-kv-k">Dosya no</span>
            <span className="desk-kv-v">{(dosya.dosyaNumarasi ?? "").trim() || "—"}</span>
          </div>
          <div className="desk-kv desk-kv--wide">
            <span className="desk-kv-k">Not</span>
            <span className="desk-kv-v">{(dosya.not ?? "").trim() || "—"}</span>
          </div>
        </div>
      </div>

      {smmBekleyen.length > 0 ? (
        <div className="desk-file-smm-banner" role="alert">
          {smmBekleyen.length === 1
            ? "Serbest meslek makbuzu kesilmemiş tahsilat var."
            : `Serbest meslek makbuzu kesilmemiş ${smmBekleyen.length} tahsilat var.`}
          <div className="desk-file-smm-banner-sub">
            Vekalet ücreti tahsilatı için SMM durumunu kontrol edin.
          </div>
        </div>
      ) : null}

      <div className="desk-dosya-scroll-stack">
        <div className="desk-dosya-layout">
          <DosyaKasaHareketleriPanel kasa={kasa} />

          <div className="desk-panel">
            <div className="desk-panel-head">
              <span>Hızlı işlemler</span>
            </div>
            <div className="desk-sidebar-btns">
              <button type="button" className="btn btn-primary btn-sm desk-btn-block" onClick={() => setIslemSecimOpen(true)}>
                + İşlem ekle
              </button>
              <button type="button" className="btn btn-sm desk-btn-block" onClick={() => setEditOpen(true)}>
                Dosyayı düzenle
              </button>
              <button type="button" className="btn btn-sm desk-btn-block" onClick={hesapOzetiYazdir}>
                Hesap Özeti Yazdır
              </button>
              <Link className="btn btn-sm desk-btn-block" to={`/muvekkil/${mid}`}>
                Müvekkil kartı
              </Link>
            </div>
            <div className="desk-panel-foot">
              Onaysız satırlar da kasa toplamlarına dahildir. Program kapanırken onaysız işlemler otomatik onaylanır;
              onaylı işlem silinemez.
            </div>
          </div>
        </div>

        <div className="desk-subpanels">
          <DosyaMasraflarPanel kasa={kasa} />

          <div className="desk-panel">
            <div className="desk-panel-head">
              <span>Anlaşılan vekalet ücreti ve taksitler</span>
              <span className="desk-panel-meta">{taksitMeta}</span>
            </div>
            <div className="desk-panel-body desk-panel-body--pad-sm">
              <VekaletTaksitlerTab
                dosyaId={did}
                muvekkilId={mid}
                compact
                onSmmChange={vekaletDegisti}
                onTaksitSayisi={setTaksitSayisi}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="desk-summary-bar desk-summary-bar--dosya-footer">
        <div className="desk-metric desk-metric--accent-avans">
          <span className="l">Toplam avans</span>
          <span className="v">{kasa.ozet ? formatTry(kasa.ozet.toplamAvans) : "—"}</span>
        </div>
        <div className="desk-metric desk-metric--accent-masraf">
          <span className="l">Toplam masraf</span>
          <span className="v">{kasa.ozet ? formatTry(kasa.ozet.toplamMasraf) : "—"}</span>
        </div>
        <div className="desk-metric desk-metric--accent-kalan-avans">
          <span className="l">Kalan avans</span>
          <span className="v">{kasa.ozet ? formatTry(kasa.ozet.kalanAvans) : "—"}</span>
        </div>
        <div className="desk-metric desk-metric--accent-vekalet">
          <span className="l">Vekalet (anlaşılan)</span>
          <span className="v">{vekaletAnlasilan > 0 ? formatTry(vekaletAnlasilan) : "—"}</span>
        </div>
        <div className="desk-metric desk-metric--accent-vekalet-odenen">
          <span className="l">Ödenen</span>
          <span className="v">{vekaletOdenen > 0 ? formatTry(vekaletOdenen) : "—"}</span>
        </div>
        <div className="desk-metric desk-metric--accent-vekalet-kalan">
          <span className="l">Kalan vekalet</span>
          <span className="v">{vekaletAnlasilan > 0 ? formatTry(vekaletKalan) : "—"}</span>
        </div>
      </div>

      <DosyaKasaModals kasa={kasa} />

      <IslemEkleSecimModal
        open={islemSecimOpen}
        onClose={() => setIslemSecimOpen(false)}
        onAvans={() => kasa.openIslemEkle()}
        onMasraf={() => kasa.openMasrafEkle()}
      />

      <DosyaFormModal
        title="Dosyayı düzenle"
        open={editOpen}
        saving={editSaving}
        error={editErr}
        initial={dosya}
        onClose={() => !editSaving && setEditOpen(false)}
        onSave={kaydetDosya}
      />
    </div>
  );
}
