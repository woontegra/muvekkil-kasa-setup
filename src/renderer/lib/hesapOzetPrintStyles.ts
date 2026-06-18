/** Hesap özeti yazdırma penceresi için gömülü CSS (A4 dikey) */
export const HESAP_OZETI_PRINT_CSS = `
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; }
body { margin: 0; padding: 0; background: #fff; color: #111; font-family: "Segoe UI", Tahoma, Arial, sans-serif; }
.hesap-ozeti-doc { background: #fff; color: #111; padding: 0; font-size: 10px; line-height: 1.35; }
.hesap-ozeti-header { display: grid; grid-template-columns: 1fr minmax(0, 42%); gap: 10px 16px; align-items: start; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2px solid #1a1a1a; }
.hesap-ozeti-header-left { display: flex; gap: 10px; align-items: flex-start; }
.hesap-ozeti-logo img { max-height: 48px; max-width: 100px; object-fit: contain; display: block; }
.hesap-ozeti-firma { font-size: 12px; font-weight: 700; }
.hesap-ozeti-avukat { font-size: 11px; font-weight: 600; margin-top: 2px; }
.hesap-ozeti-mini { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 6px; }
.hesap-ozeti-mini th { text-align: left; font-weight: 600; color: #333; padding: 1px 8px 1px 0; vertical-align: top; white-space: nowrap; width: 4.5rem; }
.hesap-ozeti-mini td { padding: 1px 0; vertical-align: top; }
.hesap-ozeti-header-right { text-align: right; }
.hesap-ozeti-title { margin: 0 0 4px; font-size: 13px; font-weight: 800; letter-spacing: 0.04em; color: #000; }
.hesap-ozeti-meta { margin: 0; font-size: 9.5px; color: #444; }
.hesap-ozeti-block { margin-bottom: 10px; page-break-inside: avoid; }
.hesap-ozeti-h2 { margin: 0 0 6px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
.hesap-ozeti-kv { width: 100%; border-collapse: collapse; font-size: 9.5px; }
.hesap-ozeti-kv th, .hesap-ozeti-kv td { border: 1px solid #333; padding: 4px 8px; vertical-align: top; text-align: left; }
.hesap-ozeti-kv th { width: 32%; background: #f0f0f0; font-weight: 600; }
.hesap-ozeti-kv--ozet th { width: 55%; }
.hesap-ozeti-num { text-align: right; font-variant-numeric: tabular-nums; }
.hesap-ozeti-num--strong { font-weight: 700; }
.hesap-ozeti-table { width: 100%; border-collapse: collapse; font-size: 9px; }
.hesap-ozeti-table th, .hesap-ozeti-table td { border: 1px solid #333; padding: 3px 5px; vertical-align: top; }
.hesap-ozeti-table th { background: #eaeaea; font-weight: 600; text-align: left; }
.hesap-ozeti-col-num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.hesap-ozeti-muted { color: #555; font-size: 9.5px; margin: 0; }
.hesap-ozeti-sonuc { margin-top: 12px; padding: 10px 10px 8px; border: 1px solid #111; background: #fafafa; page-break-inside: avoid; }
.hesap-ozeti-sonuc-line { margin: 0 0 6px; font-size: 10.5px; }
.hesap-ozeti-notice { margin: 10px 0 0; font-size: 8.5px; color: #444; line-height: 1.4; }
.hesap-ozeti-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; page-break-inside: avoid; }
.hesap-ozeti-sign-box { border: 1px dashed #666; padding: 8px 10px 10px; }
.hesap-ozeti-sign-lbl { font-size: 9.5px; font-weight: 600; }
.hesap-ozeti-sign-line { margin-top: 28px; border-bottom: 1px solid #111; }
.hesap-ozeti-sign-sub { font-size: 8px; color: #555; margin-top: 3px; }
`;
