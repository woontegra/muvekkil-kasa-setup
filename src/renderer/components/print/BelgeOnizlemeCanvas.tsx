import { useEffect, useRef, useState } from "react";
import { getDocument, initPdfJs, pdfBase64ToBlobUrl, pdfBase64ToUint8Array } from "../../lib/pdfjsSetup";

export type OnizlemeOlcek = "gercek" | "sigdir";

type Props = {
  pdfBase64: string | null;
  olcek: OnizlemeOlcek;
  onPageCount?: (count: number) => void;
  onVisiblePage?: (page: number) => void;
};

const MM_TO_PX = 96 / 25.4;

export function BelgeOnizlemeCanvas({ pdfBase64, olcek, onPageCount, onVisiblePage }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const onPageCountRef = useRef(onPageCount);
  const onVisiblePageRef = useRef(onVisiblePage);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  onPageCountRef.current = onPageCount;
  onVisiblePageRef.current = onVisiblePage;

  useEffect(() => {
    const panel = scrollRef.current;
    if (!panel) return;
    const sync = () => {
      const w = panel.clientWidth;
      setLayoutWidth((prev) => (Math.abs(w - prev) >= 8 ? w : prev));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(panel);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfBase64 || !pagesRef.current || !scrollRef.current || layoutWidth <= 0) return;

    let cancelled = false;
    const container = pagesRef.current;
    const panel = scrollRef.current;
    container.replaceChildren();
    setEmbedUrl(null);
    let observer: IntersectionObserver | null = null;
    let fallbackUrl: string | null = null;

    void (async () => {
      try {
        await initPdfJs();
        if (cancelled) return;

        const data = pdfBase64ToUint8Array(pdfBase64);
        const doc = await getDocument({ data: data.slice(), useSystemFonts: true }).promise;
        if (cancelled) return;

        onPageCountRef.current?.(doc.numPages);

        const scrollWidth = Math.max(0, layoutWidth - 64);
        const pageNodes: HTMLElement[] = [];

        for (let i = 1; i <= doc.numPages; i += 1) {
          const page = await doc.getPage(i);
          if (cancelled) return;

          const baseViewport = page.getViewport({ scale: 1 });
          let displayW = (baseViewport.width / 72) * 25.4 * MM_TO_PX;
          if (olcek === "sigdir" && scrollWidth > 0 && displayW > scrollWidth) {
            displayW = scrollWidth;
          }
          const scale = displayW / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const frame = document.createElement("div");
          frame.className = "belge-onizleme-page";
          frame.dataset.page = String(i);
          frame.style.width = `${viewport.width}px`;
          frame.style.height = `${viewport.height}px`;

          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.className = "belge-onizleme-page-canvas";

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas context unavailable");

          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          if (cancelled) return;

          frame.appendChild(canvas);
          container.appendChild(frame);
          pageNodes.push(frame);
        }

        if (pageNodes.length === 0) throw new Error("No pages rendered");

        observer = new IntersectionObserver(
          (entries) => {
            const visible = entries
              .filter((e) => e.isIntersecting)
              .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
            const target = visible[0]?.target;
            if (target instanceof HTMLElement && target.dataset.page) {
              onVisiblePageRef.current?.(Number(target.dataset.page));
            }
          },
          { root: panel, threshold: [0.35, 0.5, 0.75] }
        );
        pageNodes.forEach((n) => observer!.observe(n));
      } catch (err) {
        if (cancelled) return;
        console.error("PDF canvas render failed, using embed fallback:", err);
        container.replaceChildren();
        fallbackUrl = pdfBase64ToBlobUrl(pdfBase64);
        setEmbedUrl(fallbackUrl);
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
    };
  }, [pdfBase64, olcek, layoutWidth]);

  useEffect(() => {
    return () => {
      if (embedUrl) URL.revokeObjectURL(embedUrl);
    };
  }, [embedUrl]);

  return (
    <div ref={scrollRef} className="belge-onizleme-preview">
      {embedUrl ? (
        <div className="belge-onizleme-embed-wrap">
          <embed className="belge-onizleme-embed" src={embedUrl} type="application/pdf" title="PDF önizleme" />
        </div>
      ) : (
        <div ref={pagesRef} className="belge-onizleme-pages" />
      )}
    </div>
  );
}
