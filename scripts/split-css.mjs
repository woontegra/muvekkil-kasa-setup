import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ref = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "Müvekkil Kasa defteri",
  "asar-extract",
  "out",
  "renderer",
  "assets",
  "index-CyyeA2qH.css"
);
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "renderer", "styles");
const lines = readFileSync(ref, "utf8").split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join("\n") + "\n";
}

writeFileSync(join(outDir, "layout.css"), slice(1, 843) + slice(1557, 1917));
writeFileSync(join(outDir, "tables.css"), slice(844, 1247) + slice(1918, 2487));
writeFileSync(join(outDir, "print.css"), slice(1248, 1556));
writeFileSync(join(outDir, "forms.css"), slice(2329, 2856));
writeFileSync(join(outDir, "auth.css"), slice(2857, lines.length));
writeFileSync(
  join(outDir, "ofis-kasa.css"),
  `/* Ofis Kasası — yeni build sınıfları (out referansı); temel yerleşim */\n` +
    `.desk-page--ofis-kasa { padding: 16px 20px; }\n` +
    `.desk-ofis-ust-ozet { margin-bottom: 12px; }\n` +
    `.desk-ofis-filtre-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }\n` +
    `.desk-table--ofis-kasa td { vertical-align: middle; }\n` +
    `.desk-home-ofis-ozet { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px 16px; margin-bottom: 16px; box-shadow: var(--shadow-card); }\n` +
    `.desk-home-ofis-ozet-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }\n` +
    `.desk-home-ofis-ozet-title { font-weight: 600; color: var(--text); }\n` +
    `.desk-home-ofis-ozet-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }\n` +
    `.desk-home-ofis-kv { display: flex; flex-direction: column; gap: 2px; }\n` +
    `.desk-home-ofis-kv .k { font-size: 12px; color: var(--text-muted); }\n` +
    `.desk-home-ofis-kv .v { font-weight: 600; }\n`
);

console.log("CSS split complete ->", outDir);
