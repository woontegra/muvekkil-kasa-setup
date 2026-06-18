import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { DosyaHesapOzetPaketi } from "@shared/types/hesapOzet";
import type { KasaMakbuzPaketi, VekaletMakbuzPaketi } from "@shared/types/makbuz";
import programLogo from "../../assets/logo-M6Wo_PDM.png";
import { BelgeOnizlemeCanvas, type OnizlemeOlcek } from "../../components/print/BelgeOnizlemeCanvas";
import { KasaMakbuzSheet, VekaletMakbuzSheet } from "../../components/makbuz/MakbuzSheets";
import { HesapOzetSheet } from "../../components/hesapOzet/HesapOzetSheet";
import { useBelgeYazicilar } from "../../hooks/useBelgeYazicilar";
import { buildHesapOzetPrintHtml } from "../../lib/hesapOzetPrintDocument";
import { buildMakbuzPrintHtml } from "../../lib/makbuzPrintDocument";
import { handlePrintResult, htmlToPdfDocument, silentPrintPdf } from "../../lib/printDocument";

type BelgeKind = "hesap-ozeti" | "kasa-makbuz" | "vekalet-makbuz";

function useBelgeRoute(): { kind: BelgeKind; id: number } | null {
  const { dosyaId, hareketId, odemeId } = useParams();
  return useMemo(() => {
    if (dosyaId && Number.isFinite(Number(dosyaId))) return { kind: "hesap-ozeti" as const, id: Number(dosyaId) };
    if (hareketId && Number.isFinite(Number(hareketId))) return { kind: "kasa-makbuz" as const, id: Number(hareketId) };
    if (odemeId && Number.isFinite(Number(odemeId))) return { kind: "vekalet-makbuz" as const, id: Number(odemeId) };
    return null;
  }, [dosyaId, hareketId, odemeId]);
}

const BASLIK: Record<BelgeKind, string> = {
  "hesap-ozeti": "Dosya hesap özeti / ekstre",
  "kasa-makbuz": "Tahsilat makbuzu",
  "vekalet-makbuz": "Vekalet tahsilat makbuzu",
};

export function BelgeYazdirmaOnizlemePage() {
  const navigate = useNavigate();
  const route = useBelgeRoute();
  const buildRef = useRef<HTMLDivElement>(null);

  const [yukleniyor, setYukleniyor] = useState(true);
  const [pdfOlusturuluyor, setPdfOlusturuluyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sourceHtml, setSourceHtml] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [visiblePage, setVisiblePage] = useState(1);
  const [yazdiriliyor, setYazdiriliyor] = useState(false);
  const [basariMesaji, setBasariMesaji] = useState<string | null>(null);
  const [kopya, setKopya] = useState(1);
  const [olcek, setOlcek] = useState<OnizlemeOlcek>("sigdir");

  const [kasaPaket, setKasaPaket] = useState<Extract<KasaMakbuzPaketi, { ok: true }> | null>(null);
  const [vekaletPaket, setVekaletPaket] = useState<Extract<VekaletMakbuzPaketi, { ok: true }> | null>(null);
  const [hesapPaket, setHesapPaket] = useState<Extract<DosyaHesapOzetPaketi, { ok: true }> | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const routeKind = route?.kind;
  const routeId = route?.id;

  const defaults = useMemo(() => {
    if (routeKind === "hesap-ozeti") return { page: "A4" as const, landscape: false };
    return { page: "A5" as const, landscape: true };
  }, [routeKind]);

  const [kagit, setKagit] = useState<"A4" | "A5">(defaults.page);
  const [yatay, setYatay] = useState(defaults.landscape);

  const { yazicilar, seciliYazici, setSeciliYazici } = useBelgeYazicilar(true);

  useEffect(() => {
    setKagit(defaults.page);
    setYatay(defaults.landscape);
  }, [defaults.page, defaults.landscape, routeKind, routeId]);

  const yukle = useCallback(async () => {
    if (!routeKind || routeId == null || !window.api) return;
    setYukleniyor(true);
    setHata(null);
    setSourceHtml(null);
    setPdfBase64(null);
    setPageCount(0);
    setKasaPaket(null);
    setVekaletPaket(null);
    setHesapPaket(null);
    setLogoUrl(null);

    try {
      if (routeKind === "hesap-ozeti") {
        const r = await window.api.dosyaHesapOzetPaketi(routeId);
        if (!r.ok) {
          setHata(r.mesaj ?? r.error ?? "Hesap özeti yüklenemedi");
          return;
        }
        setHesapPaket(r);
        try {
          const lp = r.office.logoPath?.trim();
          if (lp) setLogoUrl(await window.api.officeLogoDataUrl(lp));
        } catch {
          setLogoUrl(null);
        }
        return;
      }
      if (routeKind === "kasa-makbuz") {
        const r = await window.api.makbuzYazdirmaPaketi(routeId);
        if (!r.ok) {
          setHata(r.mesaj ?? r.error ?? "Makbuz yüklenemedi");
          return;
        }
        setKasaPaket(r);
        return;
      }
      const r = await window.api.getVekaletPrintPackageByOdemeId(routeId);
      if (!r.ok) {
        setHata(r.mesaj ?? r.error ?? "Makbuz yüklenemedi");
        return;
      }
      setVekaletPaket(r);
    } catch {
      setHata("Belge yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  }, [routeKind, routeId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  useLayoutEffect(() => {
    if (yukleniyor) return;
    if (!hesapPaket && !kasaPaket && !vekaletPaket) return;
    const root = buildRef.current;
    if (!root) return;

    let html: string | null = null;
    if (hesapPaket) {
      const doc = root.querySelector(".hesap-ozeti-doc");
      if (doc) html = buildHesapOzetPrintHtml(doc.outerHTML);
    } else if (kasaPaket || vekaletPaket) {
      const sheet = root.querySelector(".makbuz-sheet");
      if (sheet) html = buildMakbuzPrintHtml(sheet.outerHTML);
    }
    if (html) {
      setSourceHtml(html);
    } else {
      setHata("Belge şablonu oluşturulamadı.");
    }
  }, [yukleniyor, hesapPaket, kasaPaket, vekaletPaket, logoUrl]);

  useEffect(() => {
    if (!sourceHtml) return;
    let cancelled = false;
    setPdfOlusturuluyor(true);
    setPdfBase64(null);
    setPageCount(0);
    setVisiblePage(1);

    void (async () => {
      try {
        const r = await htmlToPdfDocument(sourceHtml, { page: kagit, landscape: yatay });
        if (cancelled) return;
        if (!r.ok) {
          setHata(r.error ?? "PDF oluşturulamadı");
          return;
        }
        setPdfBase64(r.pdfBase64);
        setPageCount(r.pageCount);
      } catch {
        if (!cancelled) setHata("PDF oluşturulamadı");
      } finally {
        if (!cancelled) setPdfOlusturuluyor(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceHtml, kagit, yatay]);

  async function yazdir() {
    if (!pdfBase64) return;
    setYazdiriliyor(true);
    setBasariMesaji(null);
    try {
      const r = await silentPrintPdf({
        pdfBase64,
        deviceName: seciliYazici || undefined,
        copies: kopya,
        landscape: yatay,
      });
      handlePrintResult(r, (msg) => {
        setBasariMesaji(msg);
        window.setTimeout(() => setBasariMesaji(null), 2500);
      });
    } finally {
      setYazdiriliyor(false);
    }
  }

  if (!route) {
    return (
      <div className="belge-onizleme-screen">
        <p className="form-error">Geçersiz önizleme adresi.</p>
      </div>
    );
  }

  const baslik = BASLIK[route.kind];
  const logoSrc = logoUrl ?? programLogo;
  const hazir = !yukleniyor && !pdfOlusturuluyor && !!pdfBase64 && !hata;

  return (
    <div className="belge-onizleme-screen">
      <aside className="belge-onizleme-sidebar">
        <h1 className="belge-onizleme-title">Yazdırma önizleme</h1>
        <p className="belge-onizleme-subtitle">{baslik}</p>

        <div className="belge-onizleme-actions">
          <button
            type="button"
            className="btn btn-primary belge-onizleme-btn-yazdir"
            onClick={() => void yazdir()}
            disabled={!hazir || yazdiriliyor}
          >
            {yazdiriliyor ? "Yazdırılıyor…" : "Yazdır"}
          </button>
          <button type="button" className="btn belge-onizleme-btn-kapat" onClick={() => navigate(-1)} disabled={yazdiriliyor}>
            Kapat
          </button>
        </div>

        {basariMesaji ? <p className="belge-onizleme-ok">{basariMesaji}</p> : null}
        {yukleniyor ? <p className="belge-onizleme-status">Yükleniyor…</p> : null}
        {pdfOlusturuluyor ? <p className="belge-onizleme-status">PDF oluşturuluyor…</p> : null}
        {hata ? <p className="form-error">{hata}</p> : null}

        <div className="belge-onizleme-field">
          <label htmlFor="belge-yazici">Yazıcı</label>
          <select
            id="belge-yazici"
            value={seciliYazici}
            onChange={(e) => setSeciliYazici(e.target.value)}
            disabled={!hazir || yazicilar.length === 0}
          >
            {yazicilar.length === 0 ? <option value="">Yazıcı bulunamadı</option> : null}
            {yazicilar.map((y) => (
              <option key={y.name} value={y.name}>
                {y.displayName}
                {y.isDefault ? " (varsayılan)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="belge-onizleme-field">
          <label htmlFor="belge-kopya">Kopya sayısı</label>
          <input
            id="belge-kopya"
            type="number"
            min={1}
            max={99}
            value={kopya}
            onChange={(e) => setKopya(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
            disabled={!hazir}
          />
        </div>

        <fieldset className="belge-onizleme-fieldset" disabled={!hazir && !sourceHtml}>
          <legend>Yönlendirme</legend>
          <label className="belge-onizleme-radio">
            <input type="radio" name="yon" checked={!yatay} onChange={() => setYatay(false)} />
            Dikey
          </label>
          <label className="belge-onizleme-radio">
            <input type="radio" name="yon" checked={yatay} onChange={() => setYatay(true)} />
            Yatay
          </label>
        </fieldset>

        <div className="belge-onizleme-field">
          <label htmlFor="belge-kagit">Kağıt boyutu</label>
          <select id="belge-kagit" value={kagit} onChange={(e) => setKagit(e.target.value as "A4" | "A5")} disabled={!hazir && !sourceHtml}>
            <option value="A4">A4</option>
            <option value="A5">A5</option>
          </select>
        </div>

        <fieldset className="belge-onizleme-fieldset" disabled={!hazir}>
          <legend>Ölçek</legend>
          <label className="belge-onizleme-radio">
            <input type="radio" name="olcek" checked={olcek === "gercek"} onChange={() => setOlcek("gercek")} />
            Gerçek boyut
          </label>
          <label className="belge-onizleme-radio">
            <input type="radio" name="olcek" checked={olcek === "sigdir"} onChange={() => setOlcek("sigdir")} />
            Sayfaya sığdır
          </label>
        </fieldset>

        <div className="belge-onizleme-sayfa-info">
          <span className="belge-onizleme-sayfa-label">Sayfa</span>
          <strong>
            {pageCount > 0 ? `${visiblePage} / ${pageCount}` : "—"}
          </strong>
        </div>
      </aside>

      <BelgeOnizlemeCanvas
        pdfBase64={pdfBase64}
        olcek={olcek}
        onPageCount={setPageCount}
        onVisiblePage={setVisiblePage}
      />

      <div className="belge-pdf-build-host" aria-hidden ref={buildRef}>
        {hesapPaket ? <HesapOzetSheet paket={hesapPaket} logoSrc={logoSrc} /> : null}
        {kasaPaket ? <KasaMakbuzSheet paket={kasaPaket} /> : null}
        {vekaletPaket ? <VekaletMakbuzSheet paket={vekaletPaket} /> : null}
      </div>
    </div>
  );
}
