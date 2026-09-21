import type { ReactNode } from "react";
import type { OnizlemeOlcek } from "./BelgeOnizlemeCanvas";
import { BelgeOnizlemeCanvas } from "./BelgeOnizlemeCanvas";
import type { YaziciInfo } from "@shared/types/print";

type Props = {
  baslik: string;
  altBaslik: string;
  yukleniyor: boolean;
  hata: string | null;
  pdfOlusturuluyor: boolean;
  hazir: boolean;
  yazdiriliyor: boolean;
  basariMesaji: string | null;
  pdfBase64: string | null;
  pageCount: number;
  visiblePage: number;
  onPageCount: (n: number) => void;
  onVisiblePage: (n: number) => void;
  olcek: OnizlemeOlcek;
  onOlcekChange: (v: OnizlemeOlcek) => void;
  kagit: "A4" | "A5";
  onKagitChange: (v: "A4" | "A5") => void;
  yatay: boolean;
  onYatayChange: (v: boolean) => void;
  kopya: number;
  onKopyaChange: (n: number) => void;
  yazicilar: YaziciInfo[];
  seciliYazici: string;
  onYaziciChange: (name: string) => void;
  sourceHtml: string | null;
  onYazdir: () => void;
  onClose: () => void;
  htmlBuildHost: ReactNode;
};

export function BelgeOnizlemeShell({
  baslik,
  altBaslik,
  yukleniyor,
  hata,
  pdfOlusturuluyor,
  hazir,
  yazdiriliyor,
  basariMesaji,
  pdfBase64,
  pageCount,
  visiblePage,
  onPageCount,
  onVisiblePage,
  olcek,
  onOlcekChange,
  kagit,
  onKagitChange,
  yatay,
  onYatayChange,
  kopya,
  onKopyaChange,
  yazicilar,
  seciliYazici,
  onYaziciChange,
  sourceHtml,
  onYazdir,
  onClose,
  htmlBuildHost,
}: Props) {
  return (
    <div className="belge-onizleme-screen">
      <aside className="belge-onizleme-sidebar">
        <h1 className="belge-onizleme-title">Yazdırma önizleme</h1>
        <p className="belge-onizleme-subtitle">{altBaslik || baslik}</p>

        <div className="belge-onizleme-actions">
          <button
            type="button"
            className="btn btn-primary belge-onizleme-btn-yazdir"
            onClick={onYazdir}
            disabled={!hazir || yazdiriliyor}
          >
            {yazdiriliyor ? "Yazdırılıyor…" : "Yazdır"}
          </button>
          <button type="button" className="btn belge-onizleme-btn-kapat" onClick={onClose} disabled={yazdiriliyor}>
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
            onChange={(e) => onYaziciChange(e.target.value)}
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
            onChange={(e) => onKopyaChange(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
            disabled={!hazir}
          />
        </div>

        <fieldset className="belge-onizleme-fieldset" disabled={!hazir && !sourceHtml}>
          <legend>Yönlendirme</legend>
          <label className="belge-onizleme-radio">
            <input type="radio" name="yon" checked={!yatay} onChange={() => onYatayChange(false)} />
            Dikey
          </label>
          <label className="belge-onizleme-radio">
            <input type="radio" name="yon" checked={yatay} onChange={() => onYatayChange(true)} />
            Yatay
          </label>
        </fieldset>

        <div className="belge-onizleme-field">
          <label htmlFor="belge-kagit">Kağıt boyutu</label>
          <select
            id="belge-kagit"
            value={kagit}
            onChange={(e) => onKagitChange(e.target.value as "A4" | "A5")}
            disabled={!hazir && !sourceHtml}
          >
            <option value="A4">A4</option>
            <option value="A5">A5</option>
          </select>
        </div>

        <fieldset className="belge-onizleme-fieldset" disabled={!hazir}>
          <legend>Ölçek</legend>
          <label className="belge-onizleme-radio">
            <input type="radio" name="olcek" checked={olcek === "gercek"} onChange={() => onOlcekChange("gercek")} />
            Gerçek boyut
          </label>
          <label className="belge-onizleme-radio">
            <input type="radio" name="olcek" checked={olcek === "sigdir"} onChange={() => onOlcekChange("sigdir")} />
            Sayfaya sığdır
          </label>
        </fieldset>

        <div className="belge-onizleme-sayfa-info">
          <span className="belge-onizleme-sayfa-label">Sayfa</span>
          <strong>{pageCount > 0 ? `${visiblePage} / ${pageCount}` : "—"}</strong>
        </div>
      </aside>

      <BelgeOnizlemeCanvas
        pdfBase64={pdfBase64}
        olcek={olcek}
        onPageCount={onPageCount}
        onVisiblePage={onVisiblePage}
      />

      <div className="belge-pdf-build-host" aria-hidden>
        {htmlBuildHost}
      </div>
    </div>
  );
}
