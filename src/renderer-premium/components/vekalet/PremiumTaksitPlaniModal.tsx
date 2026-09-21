import { useEffect, useMemo, useState, type FormEvent } from "react";
import { kurusBuyuktur } from "@shared/lib/moneyKurus";
import { bugunYmd, formatCurrencyInputTR, formatDateTr, formatTry, parsePosTutar } from "../../lib/format";
import {
  bolKalanTaksitlereEsit,
  hesaplaSabitTaksitPlani,
  taksitPlaniToplamDurumu,
  taksitPlaniToplamMesaj,
  vadeEkleAy,
  yuvarlaTaksitToplam,
} from "../../lib/vekalet";
import type { TaksitPlaniKayit } from "../../hooks/useVekaletTaksit";
import { MoneyInput } from "../MoneyInput";
import { PremiumModal } from "../modal/PremiumModal";
import { PremiumButton } from "../PremiumButton";

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
  open: boolean;
  saving: boolean;
  error: string | null;
  kalanTaksitlendirme: number;
  acikTaksitVar: boolean;
  onClose: () => void;
  onSave: (plan: TaksitPlaniKayit) => Promise<void>;
};

export function PremiumTaksitPlaniModal({
  open,
  saving,
  error,
  kalanTaksitlendirme,
  acikTaksitVar,
  onClose,
  onSave,
}: Props) {
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
  const fark = aktifToplam != null ? Math.round((aktifToplam - kalanTaksitlendirme) * 100) / 100 : null;
  const toplamDurum =
    aktifToplam != null ? taksitPlaniToplamDurumu(kalanTaksitlendirme, aktifToplam) : "GECERSIZ";
  const toplamUyari =
    ozelUyari ??
    (planTipi === "OZEL" && ozelSatirlar.length > ozelToplamSayi && Number.isFinite(ozelToplamSayi) && ozelToplamSayi >= 1
      ? "Manuel satır sayısı toplam taksit sayısını aşamaz."
      : planTipi === "OZEL" && ozelPlanToplam != null && kurusBuyuktur(ozelPlanToplam, kalanTaksitlendirme)
        ? "Yeni taksitlerin toplamı, taksitlendirilebilir kalan tutarı aşamaz."
        : planTipi === "OZEL" && aktifToplam != null && toplamDurum !== "UYGUN"
          ? taksitPlaniToplamMesaj(toplamDurum)
          : planTipi === "ESIT" && esitPlanToplam != null && kurusBuyuktur(esitPlanToplam, kalanTaksitlendirme)
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
    saving || acikTaksitVar || kalanTaksitlendirme <= 0 || (planTipi === "ESIT" ? !esitGecerli : !ozelSatirlarGecerli);

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

  async function handleSubmit(e: FormEvent) {
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
    <PremiumModal
      open={open}
      title="Taksit planı oluştur"
      wide={planTipi === "OZEL"}
      onClose={onClose}
      disabled={saving}
      footer={
        <>
          <PremiumButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
            İptal
          </PremiumButton>
          <PremiumButton type="submit" form="pm-form-taksit-plani" disabled={olusturDisabled}>
            {saving ? "Oluşturuluyor…" : "Planı oluştur"}
          </PremiumButton>
        </>
      }
    >
      <div className={`pm-taksit-plani${planTipi === "OZEL" ? " pm-taksit-plani--ozel" : ""}`}>
        {error ? <p className="pm-form-error">{error}</p> : null}
        {kalanTaksitlendirme <= 0 ? (
          <p className="pm-form-error">Taksitlendirilebilir tutar kalmadı.</p>
        ) : (
          <p className="pm-vekalet-kalan-hint">
            Taksitlendirilebilir kalan: <strong>{formatTry(kalanTaksitlendirme)}</strong>
          </p>
        )}
        {acikTaksitVar ? (
          <p className="pm-form-error">
            Mevcut açık taksitler var. Yeni plan oluşturmadan önce mevcut açık taksitleri silin veya düzenleyin.
          </p>
        ) : null}

        <fieldset className="pm-taksit-plani-mod">
          <legend className="pm-taksit-plani-mod-title">Plan tipi</legend>
          <div className="pm-taksit-plani-mod-options">
            <label className="pm-taksit-plani-radio">
              <input
                type="radio"
                name="pm-plan-tipi"
                checked={planTipi === "ESIT"}
                onChange={() => setPlanTipi("ESIT")}
                disabled={saving}
              />
              <span>Eşit taksit</span>
            </label>
            <label className="pm-taksit-plani-radio">
              <input
                type="radio"
                name="pm-plan-tipi"
                checked={planTipi === "OZEL"}
                onChange={() => setPlanTipi("OZEL")}
                disabled={saving}
              />
              <span>Özel dağılım</span>
            </label>
          </div>
        </fieldset>

        <form id="pm-form-taksit-plani" className="pm-form-stack" onSubmit={(e) => void handleSubmit(e)}>
          {planTipi === "ESIT" ? (
            <>
              <div className="pm-field">
                <label htmlFor="pm-tp-tutar">Taksit tutarı *</label>
                <MoneyInput
                  id="pm-tp-tutar"
                  value={taksitTutari}
                  onChange={setTaksitTutari}
                  placeholder="ör. 5.000"
                  disabled={acikTaksitVar || kalanTaksitlendirme <= 0}
                />
              </div>
              <div className="pm-form-row">
                <div className="pm-field">
                  <label htmlFor="pm-tp-adet">Taksit sayısı *</label>
                  <input
                    id="pm-tp-adet"
                    type="text"
                    inputMode="numeric"
                    className="pm-input"
                    value={adet}
                    onChange={(e) => setAdet(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                    disabled={acikTaksitVar}
                  />
                </div>
                <div className="pm-field">
                  <label htmlFor="pm-tp-baslangic">Başlangıç tarihi *</label>
                  <input
                    id="pm-tp-baslangic"
                    type="date"
                    className="pm-input"
                    value={baslangic}
                    onChange={(e) => baslangicDegistir(e.target.value)}
                    disabled={acikTaksitVar}
                  />
                </div>
              </div>
              {onizleme ? (
                <div className="pm-taksit-plani-onizleme">
                  <span className="pm-taksit-plani-onizleme-lbl">Önizleme</span>
                  <span>{onizleme}</span>
                </div>
              ) : null}
              <p className="pm-form-hint">
                Her taksit aynı tutarda oluşturulur. Vadeler başlangıç tarihinden itibaren aylık ilerler.
              </p>
            </>
          ) : (
            <>
              <div className="pm-form-row">
                <div className="pm-field">
                  <label htmlFor="pm-tp-ozel-baslangic">İlk vade tarihi *</label>
                  <input
                    id="pm-tp-ozel-baslangic"
                    type="date"
                    className="pm-input"
                    value={baslangic}
                    onChange={(e) => baslangicDegistir(e.target.value)}
                    disabled={acikTaksitVar}
                  />
                </div>
                <div className="pm-field">
                  <label htmlFor="pm-tp-ozel-toplam">Toplam taksit sayısı *</label>
                  <input
                    id="pm-tp-ozel-toplam"
                    type="text"
                    inputMode="numeric"
                    className="pm-input"
                    value={ozelToplamTaksit}
                    onChange={(e) => {
                      setOzelToplamTaksit(e.target.value.replace(/[^\d]/g, "").slice(0, 3));
                      setOzelUyari(null);
                    }}
                    disabled={acikTaksitVar}
                  />
                </div>
              </div>
              <div className="pm-taksit-plani-ozel-toolbar">
                <PremiumButton type="button" variant="ghost" className="pm-btn--sm" onClick={satirEkle} disabled={satirEkleDisabled}>
                  Satır ekle
                </PremiumButton>
                <PremiumButton type="button" variant="ghost" className="pm-btn--sm" onClick={kalanEsitBol} disabled={kalanEsitBolDisabled}>
                  Kalanı eşit böl
                </PremiumButton>
              </div>
              <div className="pm-vekalet-table-wrap pm-vekalet-table-wrap--plan">
                <table className="pm-vekalet-table pm-vekalet-table--plan">
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
                            className="pm-input pm-input--cell"
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
                            className="pm-input--cell"
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
                            className="pm-input pm-input--cell"
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
                          <button
                            type="button"
                            className="pm-vekalet-action pm-vekalet-action--danger"
                            title="Satır sil"
                            onClick={() => satirSil(s.key)}
                            disabled={acikTaksitVar || ozelSatirlar.length <= 1}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="pm-form-hint">
                İlk taksitleri elle girin; &quot;Kalanı eşit böl&quot; kalan tutarı toplam taksit sayısına göre otomatik
                dağıtır. Tüm satırları elle de girebilirsiniz.
              </p>
            </>
          )}

          <div className="pm-taksit-plani-ozet">
            <div className="pm-taksit-plani-ozet-row">
              <span>Kalan taksitlendirilebilir tutar</span>
              <strong>{formatTry(kalanTaksitlendirme)}</strong>
            </div>
            <div className="pm-taksit-plani-ozet-row">
              <span>Taksit toplamı</span>
              <strong>{aktifToplam != null ? formatTry(aktifToplam) : "—"}</strong>
            </div>
            <div
              className={`pm-taksit-plani-ozet-row${fark != null && Math.abs(fark) > 0.005 ? " pm-taksit-plani-ozet-row--warn" : ""}`}
            >
              <span>Fark</span>
              <strong>{fark != null ? formatTry(fark) : "—"}</strong>
            </div>
          </div>
          {toplamUyari ? <p className="pm-form-error">{toplamUyari}</p> : null}
        </form>
      </div>
    </PremiumModal>
  );
}
