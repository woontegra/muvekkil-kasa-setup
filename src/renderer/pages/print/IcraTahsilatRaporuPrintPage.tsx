import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { OfficeSettings } from "@shared/types/office";
import type { IcraTahsilatListeSatir, IcraTahsilatUstOzet } from "@shared/types/icraTahsilat";
import { BelgeOnizlemeShell } from "../../components/print/BelgeOnizlemeShell";
import { IcraTahsilatRaporSheet } from "../../components/rapor/IcraTahsilatRaporSheet";
import { useBelgeHtmlFromRef } from "../../hooks/useBelgeHtmlFromRef";
import { useBelgeOnizleme } from "../../hooks/useBelgeOnizleme";
import { ayBasiSonu } from "../../lib/ofisKasa";
import { buildRaporPrintHtml } from "../../lib/raporPrintDocument";

const BASLIK = "İcra tahsilat raporu";

export function IcraTahsilatRaporuPrintPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const buildRef = useRef<HTMLDivElement>(null);

  const filtre = useMemo(() => {
    const fallback = ayBasiSonu();
    return {
      tarihBas: (params.get("bas") ?? fallback.bas).trim().slice(0, 10),
      tarihBit: (params.get("bit") ?? fallback.bit).trim().slice(0, 10),
      alacakTuru: (params.get("tur") ?? "TUMU").trim(),
      durum: (params.get("durum") ?? "TUMU").trim(),
      q: (params.get("q") ?? "").trim(),
    };
  }, [params]);

  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [office, setOffice] = useState<OfficeSettings | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [ozet, setOzet] = useState<IcraTahsilatUstOzet | null>(null);
  const [liste, setListe] = useState<IcraTahsilatListeSatir[]>([]);

  const onizleme = useBelgeOnizleme({ page: "A4", landscape: false });

  const yukle = useCallback(async () => {
    if (!window.api?.icraTahsilatList) {
      setHata("Rapor servisi kullanılamıyor.");
      setYukleniyor(false);
      return;
    }
    setYukleniyor(true);
    setHata(null);
    onizleme.resetPdf();
    setOffice(null);
    setLogoUrl(null);
    setOzet(null);
    setListe([]);

    try {
      const [officeRow, ustOzet, rows] = await Promise.all([
        window.api.officeGet?.() ?? null,
        window.api.icraTahsilatUstOzet?.() ?? null,
        window.api.icraTahsilatList(filtre),
      ]);
      if (!officeRow) {
        setHata("Ofis bilgisi yüklenemedi.");
        return;
      }
      setOffice(officeRow);
      setOzet(ustOzet ?? null);
      setListe(Array.isArray(rows) ? rows : []);
      try {
        const lp = officeRow.logoPath?.trim();
        if (lp && window.api.officeLogoDataUrl) {
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
  }, [filtre, onizleme.resetPdf]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  useBelgeHtmlFromRef(
    buildRef,
    !yukleniyor && !!office,
    [office, logoUrl, ozet, liste, filtre],
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
      onClose={() => navigate("/icra-tahsilat")}
      htmlBuildHost={
        <div ref={buildRef}>
          {office ? (
            <IcraTahsilatRaporSheet
              office={office}
              logoSrc={logoUrl}
              tarihBas={filtre.tarihBas}
              tarihBit={filtre.tarihBit}
              alacakTuru={filtre.alacakTuru}
              durum={filtre.durum}
              arama={filtre.q}
              ozet={ozet}
              liste={liste}
            />
          ) : null}
        </div>
      }
    />
  );
}
