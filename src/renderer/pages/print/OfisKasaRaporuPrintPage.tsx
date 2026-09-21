import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { OfisKasaRaporPaketi } from "@shared/types/ofisKasa";
import { BelgeOnizlemeShell } from "../../components/print/BelgeOnizlemeShell";
import { OfisKasaRaporSheet } from "../../components/rapor/OfisKasaRaporSheet";
import { useBelgeHtmlFromRef } from "../../hooks/useBelgeHtmlFromRef";
import { useBelgeOnizleme } from "../../hooks/useBelgeOnizleme";
import { ayBasiSonu } from "../../lib/ofisKasa";
import { buildRaporPrintHtml } from "../../lib/raporPrintDocument";

const BASLIK = "Ofis kasa raporu";

export function OfisKasaRaporuPrintPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const buildRef = useRef<HTMLDivElement>(null);

  const { bas, bit } = useMemo(() => {
    const fallback = ayBasiSonu();
    return {
      bas: (params.get("bas") ?? fallback.bas).trim().slice(0, 10),
      bit: (params.get("bit") ?? fallback.bit).trim().slice(0, 10),
    };
  }, [params]);

  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [paket, setPaket] = useState<Extract<OfisKasaRaporPaketi, { ok: true }> | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const onizleme = useBelgeOnizleme({ page: "A4", landscape: false });

  const yukle = useCallback(async () => {
    if (!window.api?.ofisKasaRaporPaketi) {
      setHata("Rapor servisi kullanılamıyor.");
      setYukleniyor(false);
      return;
    }
    setYukleniyor(true);
    setHata(null);
    onizleme.resetPdf();
    setPaket(null);
    setLogoUrl(null);

    try {
      const r = await window.api.ofisKasaRaporPaketi({ bas, bit });
      if (!r.ok) {
        setHata(r.mesaj ?? "Rapor verisi alınamadı.");
        return;
      }
      setPaket(r);
      try {
        const lp = r.office.logoPath?.trim();
        if (lp) {
          setLogoUrl(await window.api.officeLogoDataUrl(lp));
        }
      } catch {
        setLogoUrl(null);
      }
    } catch {
      setHata("Rapor verisi alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [bas, bit, onizleme.resetPdf]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  useBelgeHtmlFromRef(
    buildRef,
    !yukleniyor && !!paket,
    [paket, logoUrl],
    ".hesap-ozeti-doc",
    (outer) => buildRaporPrintHtml(outer, BASLIK),
    onizleme.setSourceHtml,
    (mesaj) => setHata(mesaj),
  );

  const gorunenHata = hata ?? onizleme.pdfHata;

  return (
    <BelgeOnizlemeShell
      baslik={BASLIK}
      altBaslik={BASLIK}
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
      onClose={() => navigate("/ofis-kasasi")}
      htmlBuildHost={
        <div ref={buildRef}>{paket ? <OfisKasaRaporSheet paket={paket} logoSrc={logoUrl} /> : null}</div>
      }
    />
  );
}
