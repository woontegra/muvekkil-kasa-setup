/**
 * Hafif regresyon: para formatı + modal backdrop kapatma yok.
 * Çalıştırma: node scripts/test-input-modal-regression.cjs
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const formatSrc = path.join(root, "src", "renderer", "lib", "format.ts");
const backdropSrc = path.join(root, "src", "renderer", "components", "DeskModalBackdrop.tsx");
const moneySrc = path.join(root, "src", "renderer", "components", "MoneyInput.tsx");
const outDir = path.join(root, ".tmp-test");
const formatOut = path.join(outDir, "format-regression.mjs");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function buildFormatModule() {
  fs.mkdirSync(outDir, { recursive: true });
  const esbuildBin = path.join(root, "node_modules", "esbuild", "bin", "esbuild");
  const r = spawnSync(
    process.execPath,
    [esbuildBin, formatSrc, "--bundle", "--format=esm", "--platform=neutral", `--outfile=${formatOut}`],
    { cwd: root, encoding: "utf8" },
  );
  if (r.status !== 0) {
    throw new Error(`esbuild format.ts başarısız:\n${r.stderr || r.stdout}`);
  }
}

async function testMoneyFormat() {
  buildFormatModule();
  const mod = await import(`file:///${formatOut.replace(/\\/g, "/")}`);
  const { formatMoneyTypingTR, formatCurrencyInputTR, parseCurrencyInputTR } = mod;

  assert(formatMoneyTypingTR("5000") === "5.000", `5000 → ${formatMoneyTypingTR("5000")}`);
  assert(formatMoneyTypingTR("100000") === "100.000", `100000 → ${formatMoneyTypingTR("100000")}`);
  assert(formatMoneyTypingTR("100000,50") === "100.000,50", `100000,50 → ${formatMoneyTypingTR("100000,50")}`);
  assert(formatMoneyTypingTR("") === "", "boş string korunmalı");
  assert(formatCurrencyInputTR(100000) === "100.000,00", `blur 100000 → ${formatCurrencyInputTR(100000)}`);
  assert(parseCurrencyInputTR("") === null, "boş parse null");
  assert(parseCurrencyInputTR("100.000,50") === 100000.5, "parse TR");

  let draft = formatMoneyTypingTR("");
  assert(draft === "", "silindiğinde boş");
  draft = formatMoneyTypingTR("12");
  assert(draft === "12", `tekrar yaz → ${draft}`);
  draft = formatMoneyTypingTR("1234");
  assert(draft === "1.234", `yeni değer → ${draft}`);

  console.log("[PASS] Money format regresyonları");
}

function testBackdropSource() {
  const src = fs.readFileSync(backdropSrc, "utf8");
  assert(!/onClose\(\)/.test(src), "DeskModalBackdrop onClose() çağırmamalı");
  assert(!/onMouseDown/.test(src) && !/onMouseUp/.test(src), "backdrop mouse close handler olmamalı");
  assert(/role="presentation"/.test(src), "presentation role korunmalı");
  console.log("[PASS] DeskModalBackdrop backdrop-close yok");
}

function testMoneyInputSource() {
  const src = fs.readFileSync(moneySrc, "utf8");
  assert(/draft/.test(src), "odak iç draft olmalı");
  assert(!/requestAnimationFrame/.test(src), "rAF caret döngüsü olmamalı");
  assert(!/setTimeout\(/.test(src), "setTimeout caret hack olmamalı");
  assert(/queueMicrotask/.test(src), "tek seferlik caret microtask olmalı");
  console.log("[PASS] MoneyInput kaynak kuralları");
}

function testNoActiveBackdropClose() {
  const rendererRoot = path.join(root, "src", "renderer");
  const offenders = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        walk(p);
        continue;
      }
      if (!/\.(tsx|ts)$/.test(name)) continue;
      if (name === "DeskModalBackdrop.tsx") continue;
      const lines = fs.readFileSync(p, "utf8").split("\n");
      lines.forEach((line, i) => {
        const t = line.trim();
        if (!t.includes("closeOnBackdrop")) return;
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
        // Yalnızca true / shorthand / dinamik true-benzeri
        if (
          /closeOnBackdrop(?!\s*=)/.test(t) ||
          /closeOnBackdrop\s*=\s*\{\s*true\s*\}/.test(t) ||
          /closeOnBackdrop\s*=\s*true\b/.test(t) ||
          /closeOnBackdrop\s*=\s*\{[^}]*closeAllowed/.test(t)
        ) {
          offenders.push(`${path.relative(root, p)}:${i + 1}: ${t}`);
        }
      });
    }
  }
  walk(rendererRoot);
  assert(offenders.length === 0, `Backdrop close açık bırakılmış:\n${offenders.join("\n")}`);
  console.log("[PASS] closeOnBackdrop aktif kullanımı yok");
}

async function main() {
  console.log("=== Input / Modal regresyon ===");
  await testMoneyFormat();
  testBackdropSource();
  testMoneyInputSource();
  testNoActiveBackdropClose();
  console.log("=== TÜM REGRESYONLAR GEÇTİ ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
