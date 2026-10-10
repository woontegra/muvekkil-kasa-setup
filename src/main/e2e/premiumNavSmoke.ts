/**
 * Premium navigation + import integrity smoke.
 * Catches ReferenceError-class bugs (e.g. useYaklasikTryBatch is not defined)
 * and verifies Tahsilat Merkezi → Dosyaya git route wiring.
 * Temp DB only for optional IPC seed checks — no AppData writes.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function walkTsx(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTsx(p, acc);
    else if (/\.(tsx|ts)$/.test(name) && !name.endsWith(".d.ts")) acc.push(p);
  }
  return acc;
}

function hasNamedImport(src: string, symbol: string): boolean {
  const re = new RegExp(
    String.raw`import\s*(?:type\s*)?\{[^}]*\b${symbol}\b[^}]*\}\s*from\s*['"][^'"]+['"]`,
  );
  return re.test(src);
}

function usesSymbol(src: string, symbol: string): boolean {
  // Ignore the import line itself and export declarations of the symbol.
  const withoutImports = src
    .split("\n")
    .filter((l) => !/^\s*import\b/.test(l))
    .join("\n");
  const re = new RegExp(String.raw`\b${symbol}\b`);
  return re.test(withoutImports);
}

/** Symbols that must be imported when used (common crash sources). */
const CRITICAL_SYMBOLS = [
  "useYaklasikTryBatch",
  "yaklasikByKey",
  "BugunkuTlKarsilikCell",
  "BUGUNKU_TL_KUR_HINT",
  "StatusBadge",
  "PremiumButton",
  "formatMoney",
  "formatDateTr",
  "useNavigate",
  "useParams",
] as const;

export async function runPremiumNavSmoke(): Promise<void> {
  const root = join(__dirname, "../..");
  const premiumRoot = join(root, "src/renderer-premium");

  // 1) Critical panel that crashed on Dosyaya git
  const panelPath = join(premiumRoot, "components/vekalet/PremiumVekaletTaksitPanel.tsx");
  const panel = readFileSync(panelPath, "utf8");
  assert(usesSymbol(panel, "useYaklasikTryBatch"), "panel uses useYaklasikTryBatch");
  assert(hasNamedImport(panel, "useYaklasikTryBatch"), "panel imports useYaklasikTryBatch");
  assert(hasNamedImport(panel, "yaklasikByKey"), "panel imports yaklasikByKey");
  assert(hasNamedImport(panel, "BugunkuTlKarsilikCell"), "panel imports BugunkuTlKarsilikCell");
  assert(hasNamedImport(panel, "formatMoney"), "panel imports formatMoney");
  assert(hasNamedImport(panel, "StatusBadge"), "panel imports StatusBadge");
  assert(hasNamedImport(panel, "UseVekaletTaksitReturn"), "panel imports UseVekaletTaksitReturn");
  console.log("[PASS] PremiumVekaletTaksitPanel imports intact");

  // 2) Tahsilat Merkezi → Dosyaya git navigation target
  const tmHook = readFileSync(join(premiumRoot, "hooks/useTahsilatMerkezi.ts"), "utf8");
  assert(tmHook.includes("dosyayaGit"), "dosyayaGit exists");
  assert(
    tmHook.includes("`/muvekkil/${row.muvekkilId}/dosya/${row.dosyaId}`") ||
      tmHook.includes("/muvekkil/${row.muvekkilId}/dosya/${row.dosyaId}"),
    "dosyayaGit navigates to dosya detail",
  );
  const table = readFileSync(join(premiumRoot, "components/tahsilatMerkezi/TahsilatMerkeziTable.tsx"), "utf8");
  assert(table.includes("Dosyaya git"), "Dosyaya git button label");
  assert(table.includes("dosyayaGit"), "table calls dosyayaGit");

  const router = readFileSync(join(premiumRoot, "app/PremiumRouter.tsx"), "utf8");
  const requiredRoutes = [
    'path="/"',
    'path="/muvekkiller"',
    'path="/muvekkil/:id"',
    'path="/muvekkil/:muvekkilId/dosya/:dosyaId"',
    'path="/tahsilat-merkezi"',
    'path="/ofis-kasasi"',
    'path="/icra-tahsilat"',
    'path="/raporlar"',
    'path="/ayarlar"',
    'path="/dosyalar"',
    'path="/randevular"',
  ];
  for (const r of requiredRoutes) {
    assert(router.includes(r), `route missing: ${r}`);
  }
  assert(router.includes("DosyaDetailPage"), "DosyaDetailPage routed");
  console.log("[PASS] Tahsilat Merkezi → Dosya route wiring");

  // 3) Missing-file UX (no crash)
  const dosyaPage = readFileSync(join(premiumRoot, "pages/DosyaDetailPage.tsx"), "utf8");
  assert(
    dosyaPage.includes("Dosya bulunamadı veya silinmiş olabilir."),
    "missing-file message present",
  );
  assert(dosyaPage.includes("PremiumVekaletTaksitPanel"), "dosya page mounts vekalet panel");
  console.log("[PASS] DosyaDetail missing-file message");

  // 4) Project-wide: used critical symbols must be imported (same file)
  const files = walkTsx(premiumRoot);
  const violations: string[] = [];
  for (const file of files) {
    // Skip the definition files themselves
    const rel = relative(root, file).replace(/\\/g, "/");
    if (rel.endsWith("/hooks/useYaklasikTryBatch.ts")) continue;
    if (rel.endsWith("/components/kurlar/BugunkuTlKarsilikCell.tsx")) continue;
    if (rel.endsWith("/components/StatusBadge.tsx")) continue;
    if (rel.endsWith("/components/PremiumButton.tsx")) continue;
    if (rel.endsWith("/lib/format.ts")) continue;

    const src = readFileSync(file, "utf8");
    for (const sym of CRITICAL_SYMBOLS) {
      if (!usesSymbol(src, sym)) continue;
      // useNavigate / useParams come from react-router-dom — still must import
      if (hasNamedImport(src, sym)) continue;
      // Default import edge case for none of these
      violations.push(`${rel}: uses ${sym} without named import`);
    }
  }
  assert(violations.length === 0, `import integrity failures:\n${violations.join("\n")}`);
  console.log(`[PASS] Premium import integrity (${files.length} files scanned)`);

  console.log("\n=== Premium nav/import smoke: TÜM TESTLER GEÇTİ ===\n");
}
