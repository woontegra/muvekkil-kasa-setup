/** Makbuz yazdırma penceresi için gömülü CSS (A5 yatay) */
export const MAKBUZ_PRINT_CSS = `
@page { size: A5 landscape; margin: 4mm; }
* { box-sizing: border-box; }
body { margin: 0; padding: 0; background: #fff; color: #111; font-family: "Segoe UI", Tahoma, Arial, sans-serif; }
.makbuz-sheet { background: #fff; color: #111; width: 100%; padding: 4mm 5mm; font-size: 8pt; line-height: 1.24; display: flex; flex-direction: column; gap: 0.32rem; }
.makbuz-a5l-top { display: grid; grid-template-columns: 1fr minmax(0, 38%); gap: 3mm 4mm; align-items: start; padding-bottom: 0.25rem; border-bottom: 1.5px solid #111; }
.makbuz-a5l-office-head { display: flex; gap: 0.35rem; align-items: flex-start; margin-bottom: 0.15rem; }
.makbuz-a5l-logo img { max-height: 28px; max-width: 72px; object-fit: contain; display: block; }
.makbuz-a5l-firma { font-size: 8.75pt; font-weight: 700; color: #0a0a0a; line-height: 1.15; }
.makbuz-a5l-avukat { font-size: 7.75pt; font-weight: 600; margin-top: 0.06rem; }
.makbuz-a5l-mini { width: 100%; border-collapse: collapse; font-size: 7pt; }
.makbuz-a5l-mini th { text-align: left; font-weight: 600; color: #333; padding: 0.06rem 0.35rem 0.06rem 0; vertical-align: top; width: 2.8rem; white-space: nowrap; }
.makbuz-a5l-mini td { padding: 0.06rem 0; vertical-align: top; }
.makbuz-a5l-clamp2 { overflow: hidden; word-break: break-word; max-height: 2.6em; line-height: 1.15; }
.makbuz-a5l-meta { text-align: right; border-left: 1px solid #ddd; padding-left: 3mm; min-width: 0; }
.makbuz-a5l-title { margin: 0 0 0.2rem; font-size: 9.5pt; font-weight: 800; letter-spacing: 0.04em; color: #000; line-height: 1.1; text-align: center; }
.makbuz-a5l-meta-tbl { width: 100%; border-collapse: collapse; font-size: 7pt; }
.makbuz-a5l-meta-tbl th { text-align: left; font-weight: 600; padding: 0.05rem 0.35rem 0.05rem 0; color: #333; white-space: nowrap; vertical-align: top; }
.makbuz-a5l-meta-tbl td { text-align: right; padding: 0.05rem 0; vertical-align: top; word-break: break-all; }
.makbuz-a5l-panel { border: 1px solid #222; padding: 0.2rem 0.35rem; background: #fff; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.makbuz-a5l-panel--tahsil { background: #fafafa; }
.makbuz-a5l-panel-h { font-size: 6.75pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #444; margin-bottom: 0.12rem; line-height: 1; }
.makbuz-a5l-kv { width: 100%; border-collapse: collapse; font-size: 7pt; table-layout: fixed; }
.makbuz-a5l-kv th, .makbuz-a5l-kv td { border: 1px solid #333; padding: 0.12rem 0.28rem; vertical-align: top; }
.makbuz-a5l-kv th { width: 26%; background: #eee; font-weight: 600; text-align: left; }
.makbuz-a5l-kv td { word-break: break-word; }
.makbuz-a5l-tutar { font-size: 8.5pt; font-weight: 700; text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap; }
.makbuz-a5l-yazi { font-size: 6.75pt; font-style: italic; line-height: 1.15; }
.makbuz-a5l-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; flex-shrink: 0; margin-top: 0.1rem; }
.makbuz-a5l-sign-box { border: 1px dashed #666; padding: 0.2rem 0.35rem 0.25rem; }
.makbuz-a5l-sign-lbl { font-size: 6.75pt; font-weight: 600; color: #333; }
.makbuz-a5l-sign-line { margin-top: 0.85rem; border-bottom: 1px solid #111; }
.makbuz-a5l-sign-sub { font-size: 6pt; color: #555; margin-top: 0.06rem; }
.makbuz-a5l-foot { text-align: center; font-size: 6.25pt; color: #666; margin-top: auto; padding-top: 0.15rem; }
`;
