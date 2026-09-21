import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { DosyaHesapOzetPaketi } from "@shared/types/hesapOzet";
import type { KasaMakbuzPaketi, VekaletMakbuzPaketi } from "@shared/types/makbuz";
import { BelgeOnizlemeShell } from "../../components/print/BelgeOnizlemeShell";
import { KasaMakbuzSheet, VekaletMakbuzSheet } from "../../components/makbuz/MakbuzSheets";
import { HesapOzetSheet } from "../../components/hesapOzet/HesapOzetSheet";
import { useBelgeHtmlFromRef } from "../../hooks/useBelgeHtmlFromRef";
import { useBelgeOnizleme } from "../../hooks/useBelgeOnizleme";
import { buildHesapOzetPrintHtml } from "../../lib/hesapOzetPrintDocument";
import { buildMakbuzPrintHtml } from "../../lib/makbuzPrintDocument";

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
  const [hata, setHata] = useState<string | null>(null);
  const [kasaPaket, setKasaPaket] = useState<Extract<KasaMakbuzPaketi, { ok: true }> | null>(null);
  const [vekaletPaket, setVekaletPaket] = useState<Extract<VekaletMakbuzPaketi, { ok: true }> | null>(null);
  const [hesapPaket, setHesapPaket] = useState<Extract<DosyaHesapOzetPaketi, { ok: true }> | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoYukleniyor, setLogoYukleniyor] = useState(false);

  const routeKind = route?.kind;
  const routeId = route?.id;

  const defaults = useMemo(() => {
    if (routeKind === "hesap-ozeti") return { page: "A4" as const, landscape: false };
    return { page: "A5" as const, landscape: true };
  }, [routeKind]);

  const onizleme = useBelgeOnizleme(defaults);

  useEffect(() => {
    onizleme.resetPdf();
  }, [routeKind, routeId, onizleme.resetPdf]);

  const yukle = useCallback(async () => {
    if (!routeKind || routeId == null || !window.api) return;
    setYukleniyor(true);
    setHata(null);
    onizleme.resetPdf();
    setKasaPaket(null);
    setVekaletPaket(null);
    setHesapPaket(null);
    setLogoUrl(null);
    setLogoYukleniyor(false);

    try {
      if (routeKind === "hesap-ozeti") {
        const r = await window.api.dosyaHesapOzetPaketi(routeId);
        if (!r.ok) {
          setHata(r.mesaj ?? r.error ?? "Hesap özeti yüklenemedi");
          return;
        }
        setHesapPaket(r);
        const lp = r.office.logoPath?.trim();
        if (lp) {
          setLogoYukleniyor(true);
          try {
            setLogoUrl(await window.api.officeLogoDataUrl(lp));
          } catch {
            setLogoUrl(null);
          } finally {
            setLogoYukleniyor(false);
          }
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
  }, [routeKind, routeId, onizleme.resetPdf]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const htmlHazir =
    !yukleniyor && !!(hesapPaket || kasaPaket || vekaletPaket) && !(hesapPaket && logoYukleniyor);

  useBelgeHtmlFromRef(
    buildRef,
    htmlHazir,
    [hesapPaket, kasaPaket, vekaletPaket, logoUrl, logoYukleniyor],
    hesapPaket ? ".hesap-ozeti-doc" : ".makbuz-sheet",
    (outer) => {
      if (hesapPaket) return buildHesapOzetPrintHtml(outer);
      return buildMakbuzPrintHtml(outer);
    },
    onizleme.setSourceHtml,
    (mesaj) => setHata(mesaj),
  );

  if (!route) {
    return (
      <div className="belge-onizleme-screen">
        <p className="form-error">Geçersiz önizleme adresi.</p>
      </div>
    );
  }

  const baslik = BASLIK[route.kind];
  const gorunenHata = hata ?? onizleme.pdfHata;

  return (
    <BelgeOnizlemeShell
      baslik={baslik}
      altBaslik={baslik}
      yukleniyor={yukleniyor}
      hata={gorunenHata}
      pdfOlusturuluyor={onizleme.pdfOlusturuluyor}
      hazir={onizleme.hazir && !gorunenHata}
      yazdiriliyor={onizleme.yazdiriliyor}
      basariMesaji={onizleme.basariMesaji}
      pdfBase64={onizleme.pdfBase64}
      pageCount={onizleme.pageCount}
      visiblePage={onizleme.visiblePage}
      onPageCount={onizleme.setPageCount}
      onVisiblePage={onizleme.setVisiblePage}
      olcek={onizleme.olcek}
      onOlcekChange={onizleme.setOlcek}
      kagit={onizleme.kagit}
      onKagitChange={onizleme.setKagit}
      yatay={onizleme.yatay}
      onYatayChange={onizleme.setYatay}
      kopya={onizleme.kopya}
      onKopyaChange={onizleme.setKopya}
      yazicilar={onizleme.yazicilar}
      seciliYazici={onizleme.seciliYazici}
      onYaziciChange={onizleme.setSeciliYazici}
      sourceHtml={onizleme.sourceHtml}
      onYazdir={() => void onizleme.yazdir()}
      onClose={() => navigate(-1)}
      htmlBuildHost={
        <div ref={buildRef}>
          {hesapPaket ? <HesapOzetSheet paket={hesapPaket} logoSrc={logoUrl} /> : null}
          {kasaPaket ? <KasaMakbuzSheet paket={kasaPaket} /> : null}
          {vekaletPaket ? <VekaletMakbuzSheet paket={vekaletPaket} /> : null}
        </div>
      }
    />
  );
}
