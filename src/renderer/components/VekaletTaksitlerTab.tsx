import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ODEME_YONTEMI_ETIKET, ODEME_YONTEMI_KODLARI } from "@shared/constants/kasa";
import type { OdemeYontemiKodu } from "@shared/constants/kasa";
import type {
  TaksitEkleInput,
  VekaletTaksit,
  VekaletTaksitOdeme,
  VekaletUcreti,
} from "@shared/types/vekalet";
import { kurusBuyuktur, kurusFarkTl } from "@shared/lib/moneyKurus";
import { bugunYmd, formatDateTr, formatTry, parsePosTutar, formatCurrencyInputTR } from "../lib/format";
import { DeskModalBackdrop } from "./DeskModalBackdrop";
import { DeskModalPortal } from "./DeskModalPortal";
import { MoneyInput } from "./MoneyInput";
import {
  bolKalanTaksitlereEsit,
  hesaplaSabitTaksitPlani,
  taksitDurumBadgeClass,
  taksitDurumEtiket,
  taksitPlaniToplamDurumu,
  taksitPlaniToplamMesaj,
  taksitSmmHucre,
  vekaletAcikTaksitVarMi,
  vekaletOzetFromTaksitler,
  yuvarlaTaksitToplam,
  siralaVekaletTaksitleriVadeAsc,
} from "../lib/vekalet";
import { odemeEtiket } from "../lib/kasa";
import { DeskTableIconBtn } from "./DeskTableIconBtn";
import { IconGecmis, IconLira, IconMakbuz, IconSil, IconSmm } from "./DeskTableIcons";
import { formatMoney, type ParaBirimi } from "@shared/lib/paraBirimi";
import type { TaksitOdemeAlInput } from "@shared/types/vekalet";
import { CrossCurrencyPaymentFields, ParaBirimiSelect, type CrossCurrencyValue } from "./currency/CurrencyFields";
import { BugunkuTlKarsilikCell, BUGUNKU_TL_KUR_HINT } from "./kurlar/BugunkuTlKarsilikCell";
import { useYaklasikTryBatch, yaklasikByKey } from "../hooks/useYaklasikTryBatch";

type TaksitPlaniKayit =
  | { tip: "ESIT"; taksitTutari: number; adet: number; baslangicTarihi: string }
  | { tip: "OZEL"; satirlar: { tutar: number; vadeTarihi: string; aciklama: string | null }[] };

type PlanTipi = "ESIT" | "OZEL";

type OzelPlaniSatir = {
  key: string;
  tutar: string;
  vade: string;
  aciklama: string;
};

let ozelSatirKeySeq = 0;
function yeniOzelSatirKey() {
  ozelSatirKeySeq += 1;
  return `ozel-${ozelSatirKeySeq}`;
}

function ozelSatirOlustur(vade: string): OzelPlaniSatir {
  return { key: yeniOzelSatirKey(), tutar: "", vade, aciklama: "" };
}

function tutarInputStr(n: number): string {
  return formatCurrencyInputTR(n);
}

type Props = {
  dosyaId: number;
  muvekkilId: number;
  onSmmChange?: () => void;
  /** Dosya detay alt paneli: özet çubuğu ve üst araç çubuğu gizlenir */
  compact?: boolean;
  onTaksitSayisi?: (n: number) => void;
};

export function VekaletTaksitlerTab({ dosyaId, muvekkilId, onSmmChange, compact, onTaksitSayisi }: Props) {
  const navigate = useNavigate();
  const [vekalet, setVekalet] = useState<VekaletUcreti | null>(null);
  const [taksitler, setTaksitler] = useState<VekaletTaksit[]>([]);
  const [ucretOpen, setUcretOpen] = useState(false);
  const [taksitOpen, setTaksitOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [odemeTaksit, setOdemeTaksit] = useState<VekaletTaksit | null>(null);
  const [gecmisTaksit, setGecmisTaksit] = useState<VekaletTaksit | null>(null);
  const [gecmis, setGecmis] = useState<VekaletTaksitOdeme[]>([]);
  const [editOdeme, setEditOdeme] = useState<VekaletTaksitOdeme | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [siliniyor, setSiliniyor] = useState(false);
  const [silinecekTaksit, setSilinecekTaksit] = useState<VekaletTaksit | null>(null);
  const [taksitFormKey, setTaksitFormKey] = useState(0);
  const [topluSilOpen, setTopluSilOpen] = useState(false);
  const [basariMesaj, setBasariMesaj] = useState<string | null>(null);

  async function vekaletMakbuzAc(odemeId: number) {
    if (!window.api) return;
    const r = await window.api.getVekaletPrintPackageByOdemeId(odemeId);
    if (!r.ok) {
      setFormErr(r.mesaj ?? r.error ?? "Makbuz açılamadı");
      return;
    }
    navigate(`/print/makbuz/vekalet/${odemeId}`);
  }

  const onSmmChangeRef = useRef(onSmmChange);
  onSmmChangeRef.current = onSmmChange;

  const yukle = useCallback(async () => {
    if (!window.api) return;
    const v = await window.api.vekaletGetOrCreate(dosyaId, muvekkilId);
    setVekalet(v);
    const t = await window.api.vekaletTaksitList(v.id);
    setTaksitler(siralaVekaletTaksitleriVadeAsc(t));
    onSmmChangeRef.current?.();
  }, [dosyaId, muvekkilId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  useEffect(() => {
    onTaksitSayisi?.(taksitler.length);
  }, [taksitler.length, onTaksitSayisi]);

  const ozet = useMemo(
    () => vekaletOzetFromTaksitler(vekalet?.anlasilanTutar ?? 0, taksitler),
    [vekalet, taksitler]
  );

  const pb = vekalet?.paraBirimi ?? "TRY";
  const showYaklasik = pb !== "TRY" && (vekalet?.anlasilanTutar ?? 0) > 0;
  const yaklasikItems = useMemo(() => {
    if (!showYaklasik) return [];
    const items = [
      { id: "ozet.anlasilan", tutar: ozet.anlasilanTutar, paraBirimi: pb },
      { id: "ozet.odenen", tutar: ozet.odenenToplam, paraBirimi: pb },
      { id: "ozet.kalan", tutar: ozet.kalanVekalet, paraBirimi: pb },
    ];
    for (const t of taksitler) {
      items.push(
        { id: `taksit.${t.id}.tutar`, tutar: t.tutar, paraBirimi: t.paraBirimi },
        { id: `taksit.${t.id}.kalan`, tutar: t.kalanTutar, paraBirimi: t.paraBirimi },
      );
    }
    return items;
  }, [showYaklasik, ozet, taksitler, pb]);
  const yaklasikQ = useYaklasikTryBatch(pb, yaklasikItems, showYaklasik);

  const mevcutTaksitToplam = useMemo(
    () => yuvarlaTaksitToplam(taksitler.map((t) => t.tutar)),
    [taksitler],
  );

  const kalanTaksitlendirme = useMemo(() => {
    const anlasilan = vekalet?.anlasilanTutar ?? 0;
    return kurusFarkTl(anlasilan, mevcutTaksitToplam);
  }, [vekalet, mevcutTaksitToplam]);

  const taksitAsimi = useMemo(() => {
    const anlasilan = vekalet?.anlasilanTutar ?? 0;
    if (anlasilan <= 0) return null;
    if (!kurusBuyuktur(mevcutTaksitToplam, anlasilan)) return null;
    return {
      anlasilan,
      mevcutTaksitToplam,
      asan: kurusFarkTl(mevcutTaksitToplam, anlasilan),
    };
  }, [vekalet, mevcutTaksitToplam]);

  const yeniTaksitEngeli = !!taksitAsimi || kalanTaksitlendirme <= 0;

  const acikTaksitVar = useMemo(() => vekaletAcikTaksitVarMi(taksitler), [taksitler]);

  const odemeBulunanTaksitVar = useMemo(
    () =>
      taksitler.some(
        (t) =>
          t.odenenToplam > 0.005 ||
          t.smmDurumu !== "YOK" ||
          !!t.sonOdemeId ||
          !!(t.sonMakbuzNo && t.sonMakbuzNo.trim()),
      ),
    [taksitler],
  );

  const TOPLU_SIL_ENGEL =
    "Ödeme alınmış taksitler bulunduğu için taksitlerin tamamı silinemez. Önce ilgili ödeme kayıtları mevcut kurallara göre düzeltilmelidir.";

  async function tumTaksitleriSil() {
    if (!vekalet) return;
    setFormErr(null);
    setBasariMesaj(null);
    if (taksitler.length === 0) {
      setTopluSilOpen(false);
      return;
    }
    if (odemeBulunanTaksitVar) {
      setFormErr(TOPLU_SIL_ENGEL);
      setTopluSilOpen(false);
      return;
    }
    const beklenenAdet = taksitler.length;
    setSaving(true);
    try {
      const res = await window.api.vekaletTaksitleriTopluSil(vekalet.id);
      if (!res.ok) {
        setFormErr(res.error);
        await yukle();
        setTopluSilOpen(false);
        return;
      }
      setTopluSilOpen(false);
      setBasariMesaj(`${res.silinenAdet || beklenenAdet} taksit başarıyla silindi.`);
      await yukle();
      window.setTimeout(() => setBasariMesaj(null), 4000);
    } catch {
      setFormErr("Taksitler silinemedi.");
      await yukle();
      setTopluSilOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function topluSilAc() {
    setFormErr(null);
    setBasariMesaj(null);
    if (odemeBulunanTaksitVar) {
      setFormErr(TOPLU_SIL_ENGEL);
      return;
    }
    setTopluSilOpen(true);
  }

  async function taksitPlaniniKaydet(plan: TaksitPlaniKayit) {
    if (!vekalet) return;
    setFormErr(null);

    if (taksitAsimi) {
      setFormErr("Taksit toplamı anlaşılan vekalet ücretini aşıyor. Önce hatalı taksitleri düzeltin.");
      throw new Error("Taksit aşımı");
    }

    if (acikTaksitVar) {
      setFormErr("Mevcut açık taksitler var. Yeni plan oluşturmadan önce mevcut açık taksitleri silin veya düzenleyin.");
      throw new Error("Açık taksit var");
    }

    setSaving(true);
    try {
      let kayitlar: { tutar: number; vadeTarihi: string; aciklama: string | null }[] = [];

      if (plan.tip === "ESIT") {
        const tutarlar = hesaplaSabitTaksitPlani(plan.taksitTutari, plan.adet);
        if (!tutarlar || tutarlar.length === 0) {
          setFormErr("Geçerli bir taksit planı oluşturulamadı");
          throw new Error("Geçersiz plan");
        }
        const toplam = yuvarlaTaksitToplam(tutarlar);
        if (kurusBuyuktur(toplam, kalanTaksitlendirme)) {
          setFormErr("Yeni taksitlerin toplamı, taksitlendirilebilir kalan tutarı aşamaz.");
          throw new Error("Plan toplamı fazla");
        }
        kayitlar = tutarlar.map((tutar, i) => ({
          tutar,
          vadeTarihi: vadeEkleAy(plan.baslangicTarihi, i),
          aciklama: null,
        }));
      } else {
        if (plan.satirlar.length < 1 || plan.satirlar.length > 120) {
          setFormErr("Geçerli bir taksit planı oluşturulamadı");
          throw new Error("Geçersiz plan");
        }
        const toplam = yuvarlaTaksitToplam(plan.satirlar.map((s) => s.tutar));
        const durum = taksitPlaniToplamDurumu(kalanTaksitlendirme, toplam);
        if (durum !== "UYGUN") {
          setFormErr(taksitPlaniToplamMesaj(durum) ?? "Taksit toplamı kalan vekalet tutarıyla eşleşmiyor.");
          throw new Error("Plan toplamı uyumsuz");
        }
        kayitlar = plan.satirlar;
      }

      for (const satir of kayitlar) {
        const res = await window.api.vekaletTaksitEkle(vekalet.id, {
          tutar: satir.tutar,
          vadeTarihi: satir.vadeTarihi,
          aciklama: satir.aciklama,
        });
        if (!res.ok) {
          setFormErr(res.error);
          throw new Error(res.error);
        }
      }
      setPlanOpen(false);
      void yukle();
    } finally {
      setSaving(false);
    }
  }

  async function kaydetUcret(anlasilanTutar: number, paraBirimi: ParaBirimi, aciklama: string | null) {
    setFormErr(null);
    setSaving(true);
    try {
      const res = await window.api.vekaletKaydet(dosyaId, muvekkilId, { anlasilanTutar, paraBirimi, aciklama });
      if (!res.ok) {
        setFormErr(res.error);
        throw new Error(res.error);
      }
      setUcretOpen(false);
      void yukle();
    } finally {
      setSaving(false);
    }
  }

  async function kaydetTaksit(input: TaksitEkleInput) {
    if (!vekalet) return;
    setFormErr(null);
    if (taksitAsimi) {
      setFormErr("Taksit toplamı anlaşılan vekalet ücretini aşıyor. Önce hatalı taksitleri düzeltin.");
      throw new Error("Taksit aşımı");
    }
    if (kurusBuyuktur(input.tutar, kalanTaksitlendirme)) {
      setFormErr(
        `Taksit tutarı, taksitlendirilebilir kalan ${formatTry(kalanTaksitlendirme)} tutarını aşamaz.`,
      );
      throw new Error("Taksit tutarı fazla");
    }
    setSaving(true);
    try {
      const res = await window.api.vekaletTaksitEkle(vekalet.id, input);
      if (!res.ok) {
        setFormErr(res.error);
        throw new Error(res.error);
      }
      setTaksitOpen(false);
      void yukle();
    } finally {
      setSaving(false);
    }
  }

  async function kaydetOdeme(data: TaksitOdemeAlInput) {
    if (!odemeTaksit) return;
    setFormErr(null);
    setSaving(true);
    try {
      const res = await window.api.vekaletTaksitOdemeAl(odemeTaksit.id, data);
      if (!res.ok) {
        setFormErr(res.error);
        throw new Error(res.error);
      }
      setOdemeTaksit(null);
      void yukle();
    } finally {
      setSaving(false);
    }
  }

  async function acGecmis(t: VekaletTaksit) {
    setGecmisTaksit(t);
    const list = await window.api.vekaletTaksitOdemeGecmisi(t.id);
    setGecmis(list);
  }

  async function smmKes(odemeId: number) {
    const res = await window.api.vekaletSmmKesildi(odemeId);
    if (!res.ok) {
      setFormErr(res.error ?? "SMM güncellenemedi");
      return;
    }
    if (gecmisTaksit) {
      const list = await window.api.vekaletTaksitOdemeGecmisi(gecmisTaksit.id);
      setGecmis(list);
    }
    void yukle();
  }

  function silTaksitIste(t: VekaletTaksit) {
    if (siliniyor || saving) return;
    setFormErr(null);
    setSilinecekTaksit(t);
  }

  function silTaksitIptal() {
    if (siliniyor) return;
    setSilinecekTaksit(null);
  }

  async function silTaksitOnayla() {
    if (!silinecekTaksit || siliniyor) return;
    const id = silinecekTaksit.id;
    setFormErr(null);
    setSiliniyor(true);
    try {
      const res = await window.api.vekaletTaksitSil(id);
      if (!res.ok) {
        setFormErr(res.error ?? "Silinemedi");
        return;
      }
      // Onay modalını hemen kaldır — görünmez backdrop kalmasın
      setSilinecekTaksit(null);
      await yukle();
    } catch {
      setFormErr("Taksit silinemedi.");
    } finally {
      setSiliniyor(false);
    }
  }

  function tekTaksitAc() {
    if (!vekalet || vekalet.anlasilanTutar <= 0 || yeniTaksitEngeli || siliniyor) return;
    setFormErr(null);
    setSilinecekTaksit(null);
    setTaksitFormKey((k) => k + 1);
    setTaksitOpen(true);
  }

  function renderTaksitTableBody() {
    return taksitler.map((t) => {
      const smm = taksitSmmHucre(t.smmDurumu);
      const tlTutar = yaklasikByKey(yaklasikQ.data, `taksit.${t.id}.tutar`);
      const tlKalan = yaklasikByKey(yaklasikQ.data, `taksit.${t.id}.kalan`);
      return (
        <tr key={t.id}>
          <td>{t.taksitNo}</td>
          <td>{formatDateTr(t.vadeTarihi)}</td>
          <td className="num">{formatMoney(t.tutar, t.paraBirimi)}</td>
          {showYaklasik ? (
            <td className="num">
              <BugunkuTlKarsilikCell unavailable={yaklasikQ.unavailable} value={tlTutar.gosterim} />
            </td>
          ) : null}
          <td className="num">{formatMoney(t.odenenToplam, t.paraBirimi)}</td>
          <td className="num">{formatMoney(t.kalanTutar, t.paraBirimi)}</td>
          {showYaklasik ? (
            <td className="num">
              <BugunkuTlKarsilikCell unavailable={yaklasikQ.unavailable} value={tlKalan.gosterim} />
            </td>
          ) : null}
          <td>
            <span className={taksitDurumBadgeClass(t.durum)}>{taksitDurumEtiket(t.durum)}</span>
          </td>
          <td>{formatDateTr(t.sonOdemeTarihi)}</td>
          <td>
            {t.sonOdemeId ? (
              <DeskTableIconBtn
                title={t.sonMakbuzNo ? `Makbuz: ${t.sonMakbuzNo}` : "Makbuz"}
                onClick={() => void vekaletMakbuzAc(t.sonOdemeId!)}
              >
                <IconMakbuz />
              </DeskTableIconBtn>
            ) : (
              t.sonMakbuzNo ?? "—"
            )}
          </td>
          <td className="desk-smm-warn-cell">
            {smm.blink ? (
              <span className={smm.className}>{smm.label}</span>
            ) : t.smmDurumu === "KESILDI" ? (
              <span className="desk-smm-ok-badge">{smm.label}</span>
            ) : (
              "—"
            )}
          </td>
          <td>
            <div className="row-actions">
              {t.kalanTutar > 0 ? (
                <DeskTableIconBtn
                  title="Ödeme al"
                  variant="primary"
                  onClick={() => {
                    setFormErr(null);
                    setOdemeTaksit(t);
                  }}
                >
                  <IconLira />
                </DeskTableIconBtn>
              ) : null}
              {t.smmDurumu === "BEKLIYOR" && t.smmBekleyenOdemeId ? (
                <DeskTableIconBtn title="SMM Kesildi" variant="warning" onClick={() => void smmKes(t.smmBekleyenOdemeId!)}>
                  <IconSmm />
                </DeskTableIconBtn>
              ) : null}
              <DeskTableIconBtn title="Ödeme geçmişi" onClick={() => void acGecmis(t)}>
                <IconGecmis />
              </DeskTableIconBtn>
              {t.odenenToplam <= 0 ? (
                <DeskTableIconBtn title="Sil" variant="danger" onClick={() => silTaksitIste(t)}>
                  <IconSil />
                </DeskTableIconBtn>
              ) : null}
            </div>
          </td>
        </tr>
      );
    });
  }

  function renderTaksitTable(showEmptyRow: boolean) {
    return (
      <div className={compact ? "desk-table-wrap desk-vekalet-taksit-wrap" : "desk-table-wrap"}>
        <table className="desk-table desk-table--striped desk-table--compact desk-table--vekalet-taksit">
          <thead>
            <tr>
              <th>Taksit no</th>
              <th>Vade tarihi</th>
              <th className="num">Taksit tutarı</th>
              {showYaklasik ? <th className="num">Bugünkü TL karşılığı</th> : null}
              <th className="num">Ödenen</th>
              <th className="num">Kalan</th>
              {showYaklasik ? <th className="num">Kalan TL karşılığı</th> : null}
              <th>Durum</th>
              <th>Son ödeme</th>
              <th>Makbuz son</th>
              <th>SMM</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {showEmptyRow ? (
              <tr>
                <td colSpan={showYaklasik ? 12 : 10} className="desk-muted-compact">
                  Henüz taksit tanımlanmadı.
                </td>
              </tr>
            ) : (
              renderTaksitTableBody()
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={compact ? "desk-vekalet-compact" : "desk-vekalet-tab"}>
      {!compact ? (
        <>
          <div className="desk-summary-bar">
            <div className="desk-metric desk-metric--accent-vekalet">
              <span className="l">Vekalet anlaşılmış toplam ({pb})</span>
              <span className="v">{formatMoney(ozet.anlasilanTutar, pb)}</span>
              {showYaklasik ? (
                <BugunkuTlKarsilikCell
                  unavailable={yaklasikQ.unavailable}
                  value={
                    yaklasikQ.unavailable
                      ? null
                      : yaklasikByKey(yaklasikQ.data, "ozet.anlasilan").gosterim
                        ? `≈ ${yaklasikByKey(yaklasikQ.data, "ozet.anlasilan").gosterim}`
                        : null
                  }
                />
              ) : null}
            </div>
            <div className="desk-metric desk-metric--accent-vekalet-odenen">
              <span className="l">Ödenen toplam</span>
              <span className="v">{formatMoney(ozet.odenenToplam, pb)}</span>
              {showYaklasik ? (
                <BugunkuTlKarsilikCell
                  unavailable={yaklasikQ.unavailable}
                  value={
                    yaklasikQ.unavailable
                      ? null
                      : yaklasikByKey(yaklasikQ.data, "ozet.odenen").gosterim
                        ? `≈ ${yaklasikByKey(yaklasikQ.data, "ozet.odenen").gosterim}`
                        : null
                  }
                />
              ) : null}
            </div>
            <div className="desk-metric desk-metric--accent-vekalet-kalan">
              <span className="l">Kalan vekalet</span>
              <span className="v">{formatMoney(ozet.kalanVekalet, pb)}</span>
              {showYaklasik ? (
                <BugunkuTlKarsilikCell
                  unavailable={yaklasikQ.unavailable}
                  value={
                    yaklasikQ.unavailable
                      ? null
                      : yaklasikByKey(yaklasikQ.data, "ozet.kalan").gosterim
                        ? `≈ ${yaklasikByKey(yaklasikQ.data, "ozet.kalan").gosterim}`
                        : null
                  }
                />
              ) : null}
            </div>
          </div>
          {showYaklasik && yaklasikQ.data?.kurBilgiSatiri ? (
            <p className="desk-muted-compact" title={BUGUNKU_TL_KUR_HINT}>
              {yaklasikQ.data.kurBilgiSatiri} · {BUGUNKU_TL_KUR_HINT}
            </p>
          ) : null}

          <div className="desk-toolbar desk-toolbar--tight desk-vekalet-actions-bar" style={{ marginBottom: 8 }}>
            <div className="desk-toolbar-actions">
              <button type="button" className="btn btn-sm" onClick={() => { setFormErr(null); setUcretOpen(true); }}>
                Vekalet ücreti düzenle
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!vekalet || vekalet.anlasilanTutar <= 0 || yeniTaksitEngeli || siliniyor}
                onClick={tekTaksitAc}
              >
                Tek taksit ekle
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!vekalet || vekalet.anlasilanTutar <= 0 || yeniTaksitEngeli || siliniyor}
                onClick={() => { setFormErr(null); setPlanOpen(true); }}
              >
                Taksit planı oluştur
              </button>
            </div>
            {taksitler.length > 0 ? (
              <button type="button" className="btn btn-sm btn-danger desk-vekalet-tumunu-sil" onClick={topluSilAc}>
                <IconSil />
                <span>Tüm taksitleri sil</span>
              </button>
            ) : null}
          </div>
          {!taksitAsimi && vekalet && vekalet.anlasilanTutar > 0 && kalanTaksitlendirme <= 0 ? (
            <p className="desk-vekalet-kalan-yok">Taksitlendirilebilir tutar kalmadı.</p>
          ) : null}
          {basariMesaj ? <p className="desk-vekalet-basari">{basariMesaj}</p> : null}
          {formErr && !ucretOpen && !taksitOpen && !planOpen && !odemeTaksit && !topluSilOpen && !silinecekTaksit ? (
            <p className="form-error desk-vekalet-inline-err">{formErr}</p>
          ) : null}

          {taksitAsimi ? (
            <div className="desk-vekalet-asimi-uyari" role="alert">
              <strong>Uyarı: Taksit toplamı anlaşılan vekalet ücretini aşıyor.</strong>
              <div>Taksit toplamı: {formatMoney(taksitAsimi.mevcutTaksitToplam, pb)}</div>
              <div>Anlaşılan vekalet: {formatMoney(taksitAsimi.anlasilan, pb)}</div>
              <div>Aşan tutar: {formatMoney(taksitAsimi.asan, pb)}</div>
            </div>
          ) : null}

          {renderTaksitTable(taksitler.length === 0)}
        </>
      ) : (
        <>
          <p className="desk-vekalet-compact-desc">
            Vekalet ücreti avans kasasından ayrıdır; avans bakiyesini etkilemez.
          </p>

          {taksitAsimi ? (
            <div className="desk-vekalet-asimi-uyari" role="alert">
              <strong>Uyarı: Taksit toplamı anlaşılan vekalet ücretini aşıyor.</strong>
              <div>Taksit toplamı: {formatMoney(taksitAsimi.mevcutTaksitToplam, pb)}</div>
              <div>Anlaşılan vekalet: {formatMoney(taksitAsimi.anlasilan, pb)}</div>
              <div>Aşan tutar: {formatMoney(taksitAsimi.asan, pb)}</div>
              <p className="desk-muted-compact">
                Hatalı taksitleri silerek veya tutarlarını düzenleyerek düzeltin. Düzeltmeden yeni taksit
                eklenemez.
              </p>
            </div>
          ) : null}

          {vekalet && vekalet.anlasilanTutar <= 0 ? (
            <div className="desk-vekalet-empty">
              <p className="desk-muted-compact">Henüz vekalet ücreti tanımlanmadı.</p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setFormErr(null);
                  setUcretOpen(true);
                }}
              >
                Vekalet ücreti tanımla
              </button>
            </div>
          ) : (
            <>
              <div className="desk-vekalet-ozet-wrap">
                <table className="desk-vekalet-ozet-table">
                  <thead>
                    <tr>
                      <th>ANLAŞILAN</th>
                      <th>ÖDENEN TOPLAM</th>
                      <th>KALAN VEKALET</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="num">{formatMoney(ozet.anlasilanTutar, pb)}</td>
                      <td className="num">{formatMoney(ozet.odenenToplam, pb)}</td>
                      <td className="num">{formatMoney(ozet.kalanVekalet, pb)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="desk-vekalet-compact-actions">
                <div className="desk-vekalet-compact-actions-left">
                  <button type="button" className="btn btn-sm" onClick={() => { setFormErr(null); setUcretOpen(true); }}>
                    Düzenle
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={!vekalet || vekalet.anlasilanTutar <= 0 || yeniTaksitEngeli || siliniyor}
                    onClick={tekTaksitAc}
                  >
                    Tek taksit
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!vekalet || vekalet.anlasilanTutar <= 0 || yeniTaksitEngeli || siliniyor}
                    onClick={() => { setFormErr(null); setPlanOpen(true); }}
                  >
                    Taksit planı
                  </button>
                </div>
                {taksitler.length > 0 ? (
                  <button type="button" className="btn btn-sm btn-danger desk-vekalet-tumunu-sil" onClick={topluSilAc}>
                    <IconSil />
                    <span>Tüm taksitleri sil</span>
                  </button>
                ) : null}
              </div>
              {!taksitAsimi && kalanTaksitlendirme <= 0 ? (
                <p className="desk-vekalet-kalan-yok">Taksitlendirilebilir tutar kalmadı.</p>
              ) : null}
              {basariMesaj ? <p className="desk-vekalet-basari">{basariMesaj}</p> : null}
              {formErr && !ucretOpen && !taksitOpen && !planOpen && !odemeTaksit && !topluSilOpen && !silinecekTaksit ? (
                <p className="form-error desk-vekalet-inline-err">{formErr}</p>
              ) : null}

              {taksitler.length === 0 ? (
                <div className="desk-vekalet-empty-taksit">Henüz taksit yok. Taksit ekleyin.</div>
              ) : (
                renderTaksitTable(false)
              )}
            </>
          )}
        </>
      )}

      {ucretOpen && vekalet ? (
        <VekaletUcretiModal
          open
          saving={saving}
          error={formErr}
          initial={vekalet}
          onClose={() => !saving && setUcretOpen(false)}
          onSave={kaydetUcret}
        />
      ) : null}

      {taksitOpen ? (
        <TaksitEkleModal
          key={taksitFormKey}
          open
          saving={saving}
          error={formErr}
          kalanTaksitlendirme={kalanTaksitlendirme}
          onClose={() => !saving && setTaksitOpen(false)}
          onSave={kaydetTaksit}
          onPlanOlustur={() => {
            setTaksitOpen(false);
            setFormErr(null);
            setPlanOpen(true);
          }}
        />
      ) : null}

      {planOpen ? (
        <TaksitPlaniModal
          open
          saving={saving}
          error={formErr}
          kalanTaksitlendirme={kalanTaksitlendirme}
          acikTaksitVar={acikTaksitVar}
          onClose={() => !saving && setPlanOpen(false)}
          onSave={taksitPlaniniKaydet}
        />
      ) : null}

      {odemeTaksit ? (
        <OdemeAlModal
          open
          saving={saving}
          error={formErr}
          taksit={odemeTaksit}
          onClose={() => !saving && setOdemeTaksit(null)}
          onSave={kaydetOdeme}
        />
      ) : null}

      {gecmisTaksit ? (
        <OdemeGecmisiModal
          open
          taksit={gecmisTaksit}
          odemeler={gecmis}
          onClose={() => setGecmisTaksit(null)}
          onSmmKes={(id) => void smmKes(id)}
          onMakbuz={(id) => void vekaletMakbuzAc(id)}
          onDuzenle={(o) => setEditOdeme(o)}
        />
      ) : null}

      <LegacyVekaletOdemeEditModal
        open={editOdeme != null}
        odeme={editOdeme}
        maxMahsup={
          editOdeme && gecmisTaksit
            ? Math.max(
                0,
                gecmisTaksit.tutar -
                  gecmis
                    .filter((x) => x.id !== editOdeme.id && x.makbuzDurumu !== "IPTAL" && !x.iptalTarihi)
                    .reduce((s, x) => s + x.tutar, 0),
              )
            : editOdeme?.tutar ?? 0
        }
        onClose={() => setEditOdeme(null)}
        onSaved={() => {
          if (gecmisTaksit) void acGecmis(gecmisTaksit);
          void yukle();
        }}
      />

      {topluSilOpen ? (
        <TaksitleriTopluSilModal
          open
          saving={saving}
          error={formErr}
          taksitSayisi={taksitler.length}
          taksitToplam={mevcutTaksitToplam}
          odenenToplam={ozet.odenenToplam}
          onClose={() => !saving && setTopluSilOpen(false)}
          onConfirm={() => void tumTaksitleriSil()}
        />
      ) : null}

      {silinecekTaksit ? (
        <TaksitSilOnayModal
          open
          saving={siliniyor}
          error={formErr}
          taksit={silinecekTaksit}
          onClose={silTaksitIptal}
          onConfirm={() => void silTaksitOnayla()}
        />
      ) : null}
    </div>
  );
}

function vadeEkleAy(ymd: string, ay: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1 + ay, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function VekaletUcretiModal({
  open,
  saving,
  error,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  error: string | null;
  initial: VekaletUcreti;
  onClose: () => void;
  onSave: (tutar: number, paraBirimi: ParaBirimi, aciklama: string | null) => Promise<void>;
}) {
  const [tutar, setTutar] = useState(
    initial.anlasilanTutar > 0 ? formatCurrencyInputTR(initial.anlasilanTutar) : "",
  );
  const [aciklama, setAciklama] = useState(initial.aciklama ?? "");
  const [paraBirimi, setParaBirimi] = useState<ParaBirimi>(initial.paraBirimi ?? "TRY");

  useEffect(() => {
    if (!open) return;
    setTutar(initial.anlasilanTutar > 0 ? formatCurrencyInputTR(initial.anlasilanTutar) : "");
    setAciklama(initial.aciklama ?? "");
    setParaBirimi(initial.paraBirimi ?? "TRY");
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const t = parsePosTutar(tutar);
    if (t == null) return;
    await onSave(t, paraBirimi, aciklama.trim() || null);
  }

  return (
    <DeskModalPortal>
    <DeskModalBackdrop onClose={onClose} disabled={saving} closeOnBackdrop={false}>
      <div className="modal modal-desk modal-desk--vekalet-form" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Vekalet ücreti</h2>
        </div>
        <div className="modal-body">
          {error ? <p className="form-error">{error}</p> : null}
          <form id="form-vekalet-ucret" onSubmit={(e) => void handleSubmit(e)}>
            <div className="field">
              <label htmlFor="vu-tutar">Anlaşılan tutar *</label>
              <MoneyInput id="vu-tutar" value={tutar} onChange={setTutar} />
            </div>
            <div className="field">
              <label htmlFor="vu-pb">Para birimi</label>
              <ParaBirimiSelect id="vu-pb" value={paraBirimi} onChange={setParaBirimi} disabled={saving || initial.anlasilanTutar > 0} />
            </div>
            <div className="field">
              <label htmlFor="vu-aciklama">Açıklama</label>
              <textarea id="vu-aciklama" className="desk-input" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
            </div>
          </form>
        </div>
        <div className="modal-actions modal-actions--vekalet">
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>İptal</button>
          <button type="submit" form="form-vekalet-ucret" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </DeskModalBackdrop>
    </DeskModalPortal>
  );
}

function TaksitEkleModal({
  open,
  saving,
  error,
  kalanTaksitlendirme,
  onClose,
  onSave,
  onPlanOlustur,
}: {
  open: boolean;
  saving: boolean;
  error: string | null;
  kalanTaksitlendirme: number;
  onClose: () => void;
  onSave: (input: TaksitEkleInput) => Promise<void>;
  onPlanOlustur?: () => void;
}) {
  // Her açılışta temiz form (parent key ile remount da desteklenir)
  const [tutar, setTutar] = useState("");
  const [vade, setVade] = useState(bugunYmd());
  const [aciklama, setAciklama] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTutar("");
    setVade(bugunYmd());
    setAciklama("");
    setLocalErr(null);
  }, [open]);

  if (!open) return null;

  const kalanYok = kalanTaksitlendirme <= 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setLocalErr(null);
    if (kalanYok) {
      setLocalErr("Taksitlendirilebilir tutar kalmadı.");
      return;
    }
    const t = parsePosTutar(tutar);
    if (t == null) {
      setLocalErr("Geçerli taksit tutarı girin.");
      return;
    }
    if (kurusBuyuktur(t, kalanTaksitlendirme)) {
      setLocalErr(
        `Taksit tutarı, taksitlendirilebilir kalan ${formatTry(kalanTaksitlendirme)} tutarını aşamaz.`,
      );
      return;
    }
    await onSave({ tutar: t, vadeTarihi: vade, aciklama: aciklama.trim() || null });
  }

  return (
    <DeskModalPortal>
      <DeskModalBackdrop onClose={onClose}>
        <div
          className="modal modal-desk modal-desk--vekalet-form"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="modal-head"><h2>Taksit ekle</h2></div>
          <div className="modal-body">
            {error ? <p className="form-error">{error}</p> : null}
            {localErr ? <p className="form-error">{localErr}</p> : null}
            {kalanYok ? (
              <p className="form-error">Taksitlendirilebilir tutar kalmadı.</p>
            ) : (
              <p className="desk-taksit-plani-kalan">
                Taksitlendirilebilir kalan: <strong>{formatTry(kalanTaksitlendirme)}</strong>
              </p>
            )}
            <form id="form-taksit-ekle" onSubmit={(e) => void handleSubmit(e)}>
              <div className="field">
                <label htmlFor="te-tutar">Taksit tutarı *</label>
                <MoneyInput
                  id="te-tutar"
                  value={tutar}
                  onChange={(v) => {
                    setLocalErr(null);
                    setTutar(v);
                  }}
                  disabled={saving || kalanYok}
                />
              </div>
              <div className="field">
                <label htmlFor="te-vade">Vade tarihi</label>
                <input id="te-vade" type="date" className="desk-input" value={vade} onChange={(e) => setVade(e.target.value)} disabled={saving || kalanYok} />
              </div>
              <div className="field">
                <label htmlFor="te-aciklama">Açıklama</label>
                <textarea id="te-aciklama" className="desk-input" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} disabled={saving || kalanYok} />
              </div>
              {onPlanOlustur ? (
                <p className="desk-muted-compact">
                  Birden fazla taksit mi?{" "}
                  <button type="button" className="desk-link-btn" onClick={onPlanOlustur} disabled={saving || kalanYok}>
                    Taksit planı oluştur
                  </button>
                </p>
              ) : null}
            </form>
          </div>
          <div className="modal-actions modal-actions--vekalet">
            <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>İptal</button>
            <button type="submit" form="form-taksit-ekle" className="btn btn-primary btn-sm" disabled={saving || kalanYok}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      </DeskModalBackdrop>
    </DeskModalPortal>
  );
}

function TaksitPlaniModal({
  open,
  saving,
  error,
  kalanTaksitlendirme,
  acikTaksitVar,
  onClose,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  error: string | null;
  kalanTaksitlendirme: number;
  acikTaksitVar: boolean;
  onClose: () => void;
  onSave: (plan: TaksitPlaniKayit) => Promise<void>;
}) {
  const [planTipi, setPlanTipi] = useState<PlanTipi>("ESIT");
  const [taksitTutari, setTaksitTutari] = useState("");
  const [adet, setAdet] = useState("10");
  const [ozelToplamTaksit, setOzelToplamTaksit] = useState("10");
  const [baslangic, setBaslangic] = useState(bugunYmd());
  const [ozelSatirlar, setOzelSatirlar] = useState<OzelPlaniSatir[]>(() => [ozelSatirOlustur(bugunYmd())]);
  const [ozelUyari, setOzelUyari] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const bas = bugunYmd();
    setPlanTipi("ESIT");
    setTaksitTutari("");
    setAdet("10");
    setOzelToplamTaksit("10");
    setBaslangic(bas);
    setOzelSatirlar([ozelSatirOlustur(bas)]);
    setOzelUyari(null);
  }, [open]);

  const adetSayi = Math.floor(Number(adet));
  const tutarSayi = parsePosTutar(taksitTutari);
  const tutarlar = useMemo(() => {
    if (tutarSayi == null) return null;
    return hesaplaSabitTaksitPlani(tutarSayi, adetSayi);
  }, [tutarSayi, adetSayi]);

  const esitPlanToplam = tutarlar && tutarlar.length > 0 ? yuvarlaTaksitToplam(tutarlar) : null;

  const ozelParsed = useMemo(() => {
    return ozelSatirlar.map((s) => ({
      key: s.key,
      tutar: parsePosTutar(s.tutar),
      vadeTarihi: s.vade.trim(),
      aciklama: s.aciklama.trim() || null,
      vadeGecerli: /^\d{4}-\d{2}-\d{2}$/.test(s.vade.trim()),
    }));
  }, [ozelSatirlar]);

  const ozelToplamSayi = Math.floor(Number(ozelToplamTaksit));

  const ozelPlanToplam = useMemo(() => {
    const tutarlarSatir = ozelParsed.map((s) => s.tutar).filter((t): t is number => t != null);
    if (tutarlarSatir.length === 0) return null;
    return yuvarlaTaksitToplam(tutarlarSatir);
  }, [ozelParsed]);

  const ozelManuelSayi = useMemo(
    () => ozelParsed.filter((s) => s.tutar != null && s.tutar > 0).length,
    [ozelParsed],
  );

  const ozelKalanTaksitAdedi =
    Number.isFinite(ozelToplamSayi) && ozelToplamSayi >= 1 ? Math.max(0, ozelToplamSayi - ozelManuelSayi) : 0;

  const aktifToplam = planTipi === "ESIT" ? esitPlanToplam : ozelPlanToplam;
  const fark =
    aktifToplam != null ? Math.round((aktifToplam - kalanTaksitlendirme) * 100) / 100 : null;
  const toplamDurum =
    aktifToplam != null ? taksitPlaniToplamDurumu(kalanTaksitlendirme, aktifToplam) : "GECERSIZ";
  const toplamUyari =
    ozelUyari ??
    (planTipi === "OZEL" && ozelSatirlar.length > ozelToplamSayi && Number.isFinite(ozelToplamSayi) && ozelToplamSayi >= 1
      ? "Manuel satır sayısı toplam taksit sayısını aşamaz."
      : planTipi === "OZEL" &&
          ozelPlanToplam != null &&
          kurusBuyuktur(ozelPlanToplam, kalanTaksitlendirme)
        ? "Yeni taksitlerin toplamı, taksitlendirilebilir kalan tutarı aşamaz."
        : planTipi === "OZEL" && aktifToplam != null && toplamDurum !== "UYGUN"
          ? taksitPlaniToplamMesaj(toplamDurum)
          : planTipi === "ESIT" &&
              esitPlanToplam != null &&
              kurusBuyuktur(esitPlanToplam, kalanTaksitlendirme)
            ? "Yeni taksitlerin toplamı, taksitlendirilebilir kalan tutarı aşamaz."
            : null);

  const ozelToplamSayiGecerli = Number.isFinite(ozelToplamSayi) && ozelToplamSayi >= 1 && ozelToplamSayi <= 120;

  const ozelSatirlarGecerli =
    planTipi !== "OZEL" ||
    (ozelToplamSayiGecerli &&
      ozelSatirlar.length === ozelToplamSayi &&
      ozelParsed.length > 0 &&
      ozelParsed.every((s) => s.tutar != null && s.tutar > 0 && s.vadeGecerli) &&
      ozelPlanToplam != null &&
      toplamDurum === "UYGUN" &&
      !ozelUyari);

  const esitGecerli =
    planTipi !== "ESIT" ||
    (tutarSayi != null &&
      tutarlar != null &&
      tutarlar.length > 0 &&
      Number.isFinite(adetSayi) &&
      adetSayi >= 1 &&
      adetSayi <= 120 &&
      esitPlanToplam != null &&
      !kurusBuyuktur(esitPlanToplam, kalanTaksitlendirme));

  const olusturDisabled =
    saving ||
    acikTaksitVar ||
    kalanTaksitlendirme <= 0 ||
    (planTipi === "ESIT" ? !esitGecerli : !ozelSatirlarGecerli);

  if (!open) return null;

  function satirEkle() {
    if (ozelToplamSayiGecerli && ozelSatirlar.length >= ozelToplamSayi) return;
    setOzelUyari(null);
    setOzelSatirlar((prev) => {
      const sonVade = prev.length > 0 ? prev[prev.length - 1].vade : baslangic;
      const yeniVade = prev.length > 0 ? vadeEkleAy(sonVade, 1) : baslangic;
      return [...prev, ozelSatirOlustur(yeniVade)];
    });
  }

  function satirSil(key: string) {
    setOzelUyari(null);
    setOzelSatirlar((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)));
  }

  function kalanEsitBol() {
    // Toplu tutar güncellemesi odakli MoneyInput draft'ını ezmesin
    (document.activeElement as HTMLElement | null)?.blur?.();

    const toplamSayi = Math.floor(Number(ozelToplamTaksit));
    if (!Number.isFinite(toplamSayi) || toplamSayi < 1) {
      setOzelUyari("Toplam taksit sayısı girin.");
      return;
    }
    if (ozelSatirlar.length > toplamSayi) {
      setOzelUyari("Manuel satır sayısı toplam taksit sayısını aşamaz.");
      return;
    }

    const manuel: { key: string; tutar: number; vade: string; aciklama: string }[] = [];
    for (const s of ozelSatirlar) {
      const t = parsePosTutar(s.tutar);
      if (t != null && t > 0) {
        manuel.push({ key: s.key, tutar: t, vade: s.vade.trim(), aciklama: s.aciklama });
      }
    }

    const manuelToplam = yuvarlaTaksitToplam(manuel.map((m) => m.tutar));
    if (kurusBuyuktur(manuelToplam, kalanTaksitlendirme)) {
      setOzelUyari("Yeni taksitlerin toplamı, taksitlendirilebilir kalan tutarı aşamaz.");
      return;
    }

    const kalanAdet = toplamSayi - manuel.length;
    if (kalanAdet <= 0) {
      setOzelUyari(null);
      return;
    }

    const kalanTutar = Math.round((kalanTaksitlendirme - manuelToplam) * 100) / 100;
    const dagitim = bolKalanTaksitlereEsit(kalanTutar, kalanAdet);
    if (!dagitim) return;

    const sonManuelVade =
      manuel.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(manuel[manuel.length - 1].vade)
        ? manuel[manuel.length - 1].vade
        : baslangic;

    const yeniSatirlar: OzelPlaniSatir[] = manuel.map((m, i) => ({
      key: m.key,
      tutar: tutarInputStr(m.tutar),
      vade: m.vade || (i === 0 ? baslangic : vadeEkleAy(manuel[i - 1].vade, 1)),
      aciklama: m.aciklama,
    }));

    for (let i = 0; i < kalanAdet; i++) {
      const vade = manuel.length > 0 ? vadeEkleAy(sonManuelVade, i + 1) : vadeEkleAy(baslangic, i);
      yeniSatirlar.push({
        key: yeniOzelSatirKey(),
        tutar: tutarInputStr(dagitim[i]),
        vade,
        aciklama: "",
      });
    }

    setOzelUyari(null);
    setOzelSatirlar(yeniSatirlar);
  }

  function baslangicDegistir(yeni: string) {
    setBaslangic(yeni);
    setOzelUyari(null);
    if (planTipi === "OZEL") {
      setOzelSatirlar((prev) =>
        prev.length === 0 ? [ozelSatirOlustur(yeni)] : prev.map((s, i) => (i === 0 ? { ...s, vade: yeni } : s)),
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (olusturDisabled) return;
    if (planTipi === "ESIT") {
      if (tutarSayi == null || !tutarlar || tutarlar.length === 0) return;
      await onSave({ tip: "ESIT", taksitTutari: tutarSayi, adet: adetSayi, baslangicTarihi: baslangic });
      return;
    }
    const satirlar = ozelParsed
      .filter((s) => s.tutar != null && s.vadeGecerli)
      .map((s) => ({
        tutar: s.tutar!,
        vadeTarihi: s.vadeTarihi,
        aciklama: s.aciklama,
      }));
    await onSave({ tip: "OZEL", satirlar });
  }

  const onizleme =
    planTipi === "ESIT" && tutarlar && tutarlar.length > 0 && tutarSayi != null
      ? `${tutarlar.length} taksit × ${formatTry(tutarSayi)} · toplam ${formatTry(esitPlanToplam ?? 0)} · ${formatDateTr(baslangic)} — ${formatDateTr(vadeEkleAy(baslangic, tutarlar.length - 1))}`
      : null;

  const kalanEsitBolDisabled =
    saving ||
    acikTaksitVar ||
    kalanTaksitlendirme <= 0 ||
    !ozelToplamSayiGecerli ||
    ozelKalanTaksitAdedi <= 0 ||
    (ozelPlanToplam != null && kurusBuyuktur(ozelPlanToplam, kalanTaksitlendirme)) ||
    (ozelToplamSayiGecerli && ozelSatirlar.length > ozelToplamSayi);

  const satirEkleDisabled =
    saving || acikTaksitVar || (ozelToplamSayiGecerli && ozelSatirlar.length >= ozelToplamSayi);

  return (
    <DeskModalPortal>
    <DeskModalBackdrop onClose={onClose} disabled={saving} closeOnBackdrop={false}>
      <div
        className={`modal modal-desk modal-desk--taksit-plani${planTipi === "OZEL" ? " modal-desk--taksit-plani-ozel" : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>Taksit planı oluştur</h2>
        </div>
        <div className="modal-body modal-body--taksit-plani">
          {error ? <p className="form-error">{error}</p> : null}
          {kalanTaksitlendirme <= 0 ? (
            <p className="form-error">Taksitlendirilebilir tutar kalmadı.</p>
          ) : (
            <p className="desk-taksit-plani-kalan">
              Taksitlendirilebilir kalan: <strong>{formatTry(kalanTaksitlendirme)}</strong>
            </p>
          )}
          {acikTaksitVar ? (
            <p className="form-error">
              Mevcut açık taksitler var. Yeni plan oluşturmadan önce mevcut açık taksitleri silin veya düzenleyin.
            </p>
          ) : null}

          <fieldset className="desk-taksit-plani-mod">
            <legend className="desk-taksit-plani-mod-title">Plan tipi</legend>
            <div className="desk-taksit-plani-mod-options desk-taksit-plani-mod-options--row">
              <label className="desk-taksit-plani-radio">
                <input
                  type="radio"
                  name="plan-tipi"
                  checked={planTipi === "ESIT"}
                  onChange={() => setPlanTipi("ESIT")}
                  disabled={saving}
                />
                <span>Eşit taksit</span>
              </label>
              <label className="desk-taksit-plani-radio">
                <input
                  type="radio"
                  name="plan-tipi"
                  checked={planTipi === "OZEL"}
                  onChange={() => setPlanTipi("OZEL")}
                  disabled={saving}
                />
                <span>Özel dağılım</span>
              </label>
            </div>
          </fieldset>

          <form id="form-taksit-plani" className="desk-taksit-plani-form" onSubmit={(e) => void handleSubmit(e)}>
            {planTipi === "ESIT" ? (
              <>
                <div className="field">
                  <label htmlFor="tp-tutar">Taksit tutarı *</label>
                  <MoneyInput
                    id="tp-tutar"
                    value={taksitTutari}
                    onChange={setTaksitTutari}
                    placeholder="ör. 5.000"
                    disabled={acikTaksitVar || kalanTaksitlendirme <= 0}
                  />
                </div>
                <div className="field">
                  <label htmlFor="tp-adet">Taksit sayısı *</label>
                  <input
                    id="tp-adet"
                    type="text"
                    inputMode="numeric"
                    className="desk-input desk-num"
                    value={adet}
                    onChange={(e) => setAdet(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                    disabled={acikTaksitVar}
                  />
                </div>
                <div className="field">
                  <label htmlFor="tp-baslangic">Başlangıç tarihi *</label>
                  <input
                    id="tp-baslangic"
                    type="date"
                    className="desk-input"
                    value={baslangic}
                    onChange={(e) => baslangicDegistir(e.target.value)}
                    disabled={acikTaksitVar}
                  />
                </div>

                {onizleme ? (
                  <div className="desk-taksit-plani-onizleme">
                    <span className="desk-taksit-plani-onizleme-lbl">Önizleme</span>
                    <span>{onizleme}</span>
                  </div>
                ) : null}

                <p className="desk-muted-compact">
                  Her taksit aynı tutarda oluşturulur. Vadeler başlangıç tarihinden itibaren aylık ilerler.
                </p>

                <div className="desk-taksit-plani-form-foot">
                  <div className="desk-taksit-plani-ozet">
                    <div className="desk-taksit-plani-ozet-row">
                      <span>Kalan taksitlendirilebilir tutar</span>
                      <strong>{formatTry(kalanTaksitlendirme)}</strong>
                    </div>
                    <div className="desk-taksit-plani-ozet-row">
                      <span>Taksit toplamı</span>
                      <strong>{aktifToplam != null ? formatTry(aktifToplam) : "—"}</strong>
                    </div>
                    <div
                      className={`desk-taksit-plani-ozet-row${fark != null && Math.abs(fark) > 0.005 ? " desk-taksit-plani-ozet-row--warn" : ""}`}
                    >
                      <span>Fark</span>
                      <strong>{fark != null ? formatTry(fark) : "—"}</strong>
                    </div>
                  </div>
                  {toplamUyari ? <p className="form-error">{toplamUyari}</p> : null}
                </div>
              </>
            ) : (
              <>
                <div className="desk-taksit-plani-form-top">
                  <div className="desk-taksit-plani-form-fields-row">
                    <div className="field">
                      <label htmlFor="tp-ozel-baslangic">İlk vade tarihi *</label>
                      <input
                        id="tp-ozel-baslangic"
                        type="date"
                        className="desk-input"
                        value={baslangic}
                        onChange={(e) => baslangicDegistir(e.target.value)}
                        disabled={acikTaksitVar}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="tp-ozel-toplam">Toplam taksit sayısı *</label>
                      <input
                        id="tp-ozel-toplam"
                        type="text"
                        inputMode="numeric"
                        className="desk-input desk-num"
                        value={ozelToplamTaksit}
                        onChange={(e) => {
                          setOzelToplamTaksit(e.target.value.replace(/[^\d]/g, "").slice(0, 3));
                          setOzelUyari(null);
                        }}
                        disabled={acikTaksitVar}
                      />
                    </div>
                  </div>

                  <div className="desk-taksit-plani-ozel-toolbar">
                    <button type="button" className="btn btn-sm" onClick={satirEkle} disabled={satirEkleDisabled}>
                      Satır ekle
                    </button>
                    <button type="button" className="btn btn-sm" onClick={kalanEsitBol} disabled={kalanEsitBolDisabled}>
                      Kalanı eşit böl
                    </button>
                  </div>
                </div>

                <div className="desk-taksit-plani-ozel-wrap">
                  <table className="desk-table desk-table--compact desk-table--taksit-plani-ozel">
                    <thead>
                      <tr>
                        <th>Taksit no</th>
                        <th>Vade tarihi</th>
                        <th className="num">Taksit tutarı</th>
                        <th>Açıklama</th>
                        <th>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ozelSatirlar.map((s, i) => (
                        <tr key={s.key}>
                          <td>{i + 1}</td>
                          <td>
                            <input
                              type="date"
                              className="desk-input desk-input--cell"
                              value={s.vade}
                              onChange={(e) =>
                                setOzelSatirlar((prev) =>
                                  prev.map((r) => (r.key === s.key ? { ...r, vade: e.target.value } : r)),
                                )
                              }
                              disabled={acikTaksitVar}
                            />
                          </td>
                          <td>
                            <MoneyInput
                              className="desk-input desk-input--cell desk-num"
                              value={s.tutar}
                              onChange={(v) => {
                                setOzelUyari(null);
                                setOzelSatirlar((prev) =>
                                  prev.map((r) => (r.key === s.key ? { ...r, tutar: v } : r)),
                                );
                              }}
                              placeholder="0,00"
                              disabled={acikTaksitVar || kalanTaksitlendirme <= 0}
                            />
                          </td>
                          <td>
                            <input
                              className="desk-input desk-input--cell"
                              value={s.aciklama}
                              onChange={(e) =>
                                setOzelSatirlar((prev) =>
                                  prev.map((r) => (r.key === s.key ? { ...r, aciklama: e.target.value } : r)),
                                )
                              }
                              disabled={acikTaksitVar}
                            />
                          </td>
                          <td>
                            <DeskTableIconBtn
                              title="Satır sil"
                              variant="danger"
                              onClick={() => satirSil(s.key)}
                              disabled={acikTaksitVar || ozelSatirlar.length <= 1}
                            >
                              <IconSil />
                            </DeskTableIconBtn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="desk-taksit-plani-form-foot">
                  <p className="desk-muted-compact">
                    İlk taksitleri elle girin; &quot;Kalanı eşit böl&quot; kalan tutarı toplam taksit sayısına göre otomatik
                    dağıtır. Tüm satırları elle de girebilirsiniz.
                  </p>

                  <div className="desk-taksit-plani-ozet">
                    <div className="desk-taksit-plani-ozet-row">
                      <span>Kalan taksitlendirilebilir tutar</span>
                      <strong>{formatTry(kalanTaksitlendirme)}</strong>
                    </div>
                    <div className="desk-taksit-plani-ozet-row">
                      <span>Taksit toplamı</span>
                      <strong>{aktifToplam != null ? formatTry(aktifToplam) : "—"}</strong>
                    </div>
                    <div
                      className={`desk-taksit-plani-ozet-row${fark != null && Math.abs(fark) > 0.005 ? " desk-taksit-plani-ozet-row--warn" : ""}`}
                    >
                      <span>Fark</span>
                      <strong>{fark != null ? formatTry(fark) : "—"}</strong>
                    </div>
                  </div>

                  {toplamUyari ? <p className="form-error">{toplamUyari}</p> : null}
                </div>
              </>
            )}
          </form>
        </div>
        <div className="modal-actions modal-actions--vekalet">
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>
            İptal
          </button>
          <button type="submit" form="form-taksit-plani" className="btn btn-primary btn-sm" disabled={olusturDisabled}>
            {saving ? "Oluşturuluyor…" : "Planı oluştur"}
          </button>
        </div>
      </div>
    </DeskModalBackdrop>
    </DeskModalPortal>
  );
}

function OdemeAlModal({
  open,
  saving,
  error,
  taksit,
  onClose,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  error: string | null;
  taksit: VekaletTaksit;
  onClose: () => void;
  onSave: (data: TaksitOdemeAlInput) => Promise<void>;
}) {
  const [payment, setPayment] = useState<CrossCurrencyValue | null>(null);
  const [tarih, setTarih] = useState(bugunYmd());
  const [odeme, setOdeme] = useState<OdemeYontemiKodu>("NAKIT");
  const [aciklama, setAciklama] = useState("");

  useEffect(() => {
    if (!open) return;
    setPayment(null);
    setTarih(bugunYmd());
    setOdeme("NAKIT");
    setAciklama("");
  }, [open, taksit.id]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!payment?.tutar || !payment.kasaTutari) return;
    await onSave({
      tutar: payment.tutar,
      odemeParaBirimi: payment.odemeParaBirimi,
      kasaTutari: payment.kasaTutari,
      kurKaynagi: payment.kurKaynagi,
      tcmbKurTarihi: payment.tcmbKurTarihi,
      tcmbReferansKur: payment.tcmbReferansKur,
      odemeTarihi: tarih,
      odemeYontemi: odeme,
      aciklama: aciklama.trim() || null,
    });
  }

  return (
    <DeskModalPortal>
    <DeskModalBackdrop onClose={onClose} disabled={saving} closeOnBackdrop={false}>
      <div className="modal modal-desk" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Taksit #{taksit.taksitNo} — ödeme al</h2>
        </div>
        <div className="modal-body">
          {error ? <p className="form-error">{error}</p> : null}
          <form id="form-odeme-al" onSubmit={(e) => void handleSubmit(e)}>
            <div className="desk-kvgrid" style={{ marginBottom: 12 }}>
              <div className="desk-kv">
                <span className="desk-kv-k">Taksit tutarı</span>
                <span className="desk-kv-v">{formatMoney(taksit.tutar, taksit.paraBirimi)}</span>
              </div>
              <div className="desk-kv">
                <span className="desk-kv-k">Şimdiye kadar ödenen</span>
                <span className="desk-kv-v">{formatMoney(taksit.odenenToplam, taksit.paraBirimi)}</span>
              </div>
              <div className="desk-kv">
                <span className="desk-kv-k">Ödenmesi gereken kalan</span>
                <span className="desk-kv-v">{formatMoney(taksit.kalanTutar, taksit.paraBirimi)}</span>
              </div>
            </div>
            <CrossCurrencyPaymentFields
              idPrefix="oa"
              alacakParaBirimi={taksit.paraBirimi}
              kalanBorc={taksit.kalanTutar}
              initialTutar={formatCurrencyInputTR(taksit.kalanTutar)}
              disabled={saving}
              onChange={setPayment}
            />
            <div className="field">
              <label htmlFor="oa-tarih">Ödeme tarihi</label>
              <input id="oa-tarih" type="date" className="desk-input" value={tarih} onChange={(e) => setTarih(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="oa-odeme">Ödeme yöntemi</label>
              <select id="oa-odeme" className="desk-input" value={odeme} onChange={(e) => setOdeme(e.target.value as OdemeYontemiKodu)}>
                {ODEME_YONTEMI_KODLARI.map((k) => (
                  <option key={k} value={k}>{ODEME_YONTEMI_ETIKET[k]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="oa-aciklama">Açıklama</label>
              <textarea id="oa-aciklama" className="desk-input" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
            </div>
          </form>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>İptal</button>
          <button type="submit" form="form-odeme-al" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Tahsilat kaydet"}
          </button>
        </div>
      </div>
    </DeskModalBackdrop>
    </DeskModalPortal>
  );
}

function OdemeGecmisiModal({
  open,
  taksit,
  odemeler,
  onClose,
  onSmmKes,
  onMakbuz,
  onDuzenle,
}: {
  open: boolean;
  taksit: VekaletTaksit;
  odemeler: VekaletTaksitOdeme[];
  onClose: () => void;
  onSmmKes: (odemeId: number) => void;
  onMakbuz: (odemeId: number) => void;
  onDuzenle: (odeme: VekaletTaksitOdeme) => void;
}) {
  if (!open) return null;

  return (
    <DeskModalPortal>
    <DeskModalBackdrop onClose={onClose} closeOnBackdrop={false}>
      <div className="modal modal-desk modal-desk--wide modal-desk--odeme-gecmisi" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Taksit #{taksit.taksitNo} — ödeme geçmişi</h2>
        </div>
        <div className="modal-body">
          <div className="desk-table-wrap">
            <table className="desk-table desk-table--striped desk-table--compact">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th className="desk-num">Tutar</th>
                  <th>Ödeme yöntemi</th>
                  <th>Açıklama</th>
                  <th>Makbuz no</th>
                  <th>SMM durumu</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {odemeler.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="desk-muted-compact">Ödeme kaydı yok.</td>
                  </tr>
                ) : (
                  odemeler.map((o) => (
                    <tr key={o.id}>
                      <td>{formatDateTr(o.odemeTarihi)}</td>
                      <td className="desk-num">{formatMoney(o.tutar, o.alacakParaBirimi)}</td>
                      <td>{odemeEtiket(o.odemeYontemi)}</td>
                      <td>
                        {o.aciklama ?? "—"}
                        {o.ofisKasaHareketId ? (
                          <span className="desk-muted-compact" title="Ofis Kasası'na gelir olarak işlendi">
                            {" "}
                            · Ofis kasası
                          </span>
                        ) : null}
                      </td>
                      <td>{o.makbuzNo ?? "—"}</td>
                      <td>
                        {o.smmKesildiMi ? (
                          <span className="desk-smm-ok-badge">SMM kesildi</span>
                        ) : (
                          <span className="desk-blink-warning">SMM bekliyor</span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <DeskTableIconBtn title="Makbuz" onClick={() => onMakbuz(o.id)}>
                            <IconMakbuz />
                          </DeskTableIconBtn>
                          {!o.smmKesildiMi ? (
                            <DeskTableIconBtn title="SMM Kesildi" variant="warning" onClick={() => onSmmKes(o.id)}>
                              <IconSmm />
                            </DeskTableIconBtn>
                          ) : null}
                          {o.makbuzDurumu !== "IPTAL" && !o.iptalTarihi ? (
                            <button type="button" className="btn btn-sm" onClick={() => onDuzenle(o)}>
                              Düzenle
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </DeskModalBackdrop>
    </DeskModalPortal>
  );
}

function LegacyVekaletOdemeEditModal({
  open,
  odeme,
  maxMahsup,
  onClose,
  onSaved,
}: {
  open: boolean;
  odeme: VekaletTaksitOdeme | null;
  maxMahsup: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tutar, setTutar] = useState("");
  const [tarih, setTarih] = useState("");
  const [yontem, setYontem] = useState("NAKIT");
  const [aciklama, setAciklama] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !odeme) return;
    setTutar(String(odeme.tutar).replace(".", ","));
    setTarih(odeme.odemeTarihi.slice(0, 10));
    setYontem(odeme.odemeYontemi);
    setAciklama(odeme.aciklama ?? "");
    setErr(null);
  }, [open, odeme]);

  if (!open || !odeme) return null;

  async function kaydet() {
    if (!odeme || busy) return;
    const mahsup = Number(String(tutar).replace(",", "."));
    if (!Number.isFinite(mahsup) || mahsup <= 0) {
      setErr("Geçerli tutar girin.");
      return;
    }
    if (mahsup > maxMahsup + 0.001) {
      setErr(`Mahsup tutarı kalan bakiyeyi aşamaz (${maxMahsup}).`);
      return;
    }
    setBusy(true);
    try {
      const r = await window.api.vekaletTaksitOdemeGuncelle(odeme.id, {
        tutar: mahsup,
        odemeTarihi: tarih,
        odemeYontemi: yontem,
        aciklama: aciklama.trim() || null,
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setErr("Güncelleme başarısız.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DeskModalPortal>
      <DeskModalBackdrop onClose={() => !busy && onClose()} closeOnBackdrop={false}>
        <div className="modal modal-desk" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h2>Tahsilatı düzenle</h2>
          </div>
          <div className="modal-body">
            {err ? <p className="desk-form-error">{err}</p> : null}
            <p className="desk-muted-compact">
              Onaylı ofis kasasına bağlı tahsilatlar düzenlenemez — önce güvenli iptal gerekir.
            </p>
            <div className="desk-form-grid">
              <div className="field">
                <label>Ödeme tarihi</label>
                <input className="desk-input" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
              </div>
              <div className="field">
                <label>Mahsup tutarı ({odeme.alacakParaBirimi})</label>
                <input className="desk-input" value={tutar} onChange={(e) => setTutar(e.target.value)} />
              </div>
              <div className="field">
                <label>Ödeme yöntemi</label>
                <select className="desk-input" value={yontem} onChange={(e) => setYontem(e.target.value)}>
                  {ODEME_YONTEMI_KODLARI.map((k) => (
                    <option key={k} value={k}>
                      {ODEME_YONTEMI_ETIKET[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Açıklama</label>
                <textarea className="desk-input" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-sm" disabled={busy} onClick={onClose}>
              Vazgeç
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void kaydet()}>
              Kaydet
            </button>
          </div>
        </div>
      </DeskModalBackdrop>
    </DeskModalPortal>
  );
}

function TaksitleriTopluSilModal({
  open,
  saving,
  error,
  taksitSayisi,
  taksitToplam,
  odenenToplam,
  onClose,
  onConfirm,
}: {
  open: boolean;
  saving: boolean;
  error: string | null;
  taksitSayisi: number;
  taksitToplam: number;
  odenenToplam: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <DeskModalPortal>
      <DeskModalBackdrop onClose={onClose} disabled={saving} closeOnBackdrop={false}>
        <div
          className="modal modal-desk modal-desk--vekalet-form"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vekalet-toplu-sil-title"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="modal-head">
            <h2 id="vekalet-toplu-sil-title">Tüm taksitleri sil</h2>
          </div>
          <div className="modal-body">
            {error ? <p className="form-error">{error}</p> : null}
            <p className="desk-vekalet-toplu-sil-uyari">
              Bu işlem {taksitSayisi} taksitin tamamını silecektir. Bu işlem geri alınamaz.
            </p>
            <div className="desk-vekalet-toplu-sil-ozet">
              <div className="desk-vekalet-toplu-sil-ozet-row">
                <span>Taksit sayısı</span>
                <strong>{taksitSayisi}</strong>
              </div>
              <div className="desk-vekalet-toplu-sil-ozet-row">
                <span>Taksitlerin toplam tutarı</span>
                <strong>{formatTry(taksitToplam)}</strong>
              </div>
              <div className="desk-vekalet-toplu-sil-ozet-row">
                <span>Ödenen toplam</span>
                <strong>{formatTry(odenenToplam)}</strong>
              </div>
            </div>
          </div>
          <div className="modal-actions modal-actions--vekalet">
            <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>
              İptal
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger desk-vekalet-tumunu-sil-onay"
              disabled={saving}
              onClick={onConfirm}
            >
              {saving ? "Siliniyor…" : "Tümünü sil"}
            </button>
          </div>
        </div>
      </DeskModalBackdrop>
    </DeskModalPortal>
  );
}

function TaksitSilOnayModal({
  open,
  saving,
  error,
  taksit,
  onClose,
  onConfirm,
}: {
  open: boolean;
  saving: boolean;
  error: string | null;
  taksit: VekaletTaksit;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <DeskModalPortal>
      <DeskModalBackdrop onClose={onClose}>
        <div
          className="modal modal-desk modal-desk--vekalet-form"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vekalet-taksit-sil-title"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="modal-head">
            <h2 id="vekalet-taksit-sil-title">Taksiti sil</h2>
          </div>
          <div className="modal-body">
            {error ? <p className="form-error">{error}</p> : null}
            <p>
              <strong>#{taksit.taksitNo}</strong> numaralı taksiti ({formatTry(taksit.tutar)}, vade{" "}
              {formatDateTr(taksit.vadeTarihi)}) silmek istediğinize emin misiniz?
            </p>
            <p className="desk-muted-compact">Bu işlem geri alınamaz.</p>
          </div>
          <div className="modal-actions modal-actions--vekalet">
            <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>
              İptal
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              disabled={saving}
              onClick={onConfirm}
              data-testid="vekalet-taksit-sil-onay"
            >
              {saving ? "Siliniyor…" : "Sil"}
            </button>
          </div>
        </div>
      </DeskModalBackdrop>
    </DeskModalPortal>
  );
}
