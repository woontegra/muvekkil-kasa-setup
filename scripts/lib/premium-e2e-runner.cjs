/**
 * Premium E2E Electron runner — bundle entry TS, spawn electron seri, doğrula, temiz çık.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..", "..");
const electronDir = path.join(root, "node_modules", "electron");
const electronPath = path.join(electronDir, "dist", fs.readFileSync(path.join(electronDir, "path.txt"), "utf8").trim());

const HEARTBEAT_MS = 5000;
const KILL_DRAIN_MS = 5000;
const DEFAULT_TIMEOUT_MS = 45000;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", ...opts });
  if (r.status !== 0) {
    const err = new Error(`Komut başarısız (${cmd} ${args.join(" ")}): exit ${r.status}`);
    err.exitCode = r.status ?? 1;
    throw err;
  }
}

function ensureBuilds({ premium = true, main = true } = {}) {
  if (premium && !fs.existsSync(path.join(root, "out", "renderer-premium", "index.html"))) {
    console.log("[BUILD] Premium renderer derleniyor…");
    run(process.platform === "win32" ? "npx.cmd" : "npx", [
      "electron-vite",
      "build",
      "--config",
      "electron.vite.premium.config.ts",
    ]);
  }
  if (main && !fs.existsSync(path.join(root, "out", "main", "index.js"))) {
    console.log("[BUILD] Main/preload derleniyor…");
    run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"]);
  }
}

function bundleEntry(entryTs, bundleOut) {
  const esbuild = require("esbuild");
  esbuild.buildSync({
    entryPoints: [entryTs],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: bundleOut,
    external: ["electron", "better-sqlite3", "bcryptjs"],
    alias: {
      "@shared": path.join(root, "src", "shared"),
    },
    tsconfig: path.join(root, "tsconfig.node.json"),
  });
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
  } catch {
    /* ignore */
  }
}

/**
 * @param {object} opts
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string, timedOut: boolean }>}
 */
async function spawnWithTimeout({
  command,
  args = [],
  cwd = root,
  env = process.env,
  label = "child",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pipeOutput = false,
}) {
  let stdout = "";
  let stderr = "";
  const started = Date.now();

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: pipeOutput ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true,
    });

    if (pipeOutput) {
      child.stdout?.on("data", (c) => {
        const s = String(c);
        stdout += s;
        process.stdout.write(s);
      });
      child.stderr?.on("data", (c) => {
        const s = String(c);
        stderr += s;
        process.stderr.write(s);
      });
    }

    let settled = false;
    let timedOut = false;
    let drainTimer = null;

    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearInterval(heartbeat);
      clearTimeout(timer);
      if (drainTimer) clearTimeout(drainTimer);
      resolve({ exitCode: code, timedOut });
    };

    const heartbeat = setInterval(() => {
      const elapsed = Date.now() - started;
      console.log(`[HEARTBEAT] ${label}: ${elapsed}ms / ${timeoutMs}ms`);
    }, HEARTBEAT_MS);

    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      console.error(`[FAIL] ${label}: zaman aşımı (${timeoutMs}ms)`);
      console.error(`[KILL] taskkill /PID ${child.pid} /T /F`);
      killProcessTree(child.pid);
      drainTimer = setTimeout(() => {
        console.error(`[KILL] ${label}: drain süresi doldu (${KILL_DRAIN_MS}ms), zorla çıkılıyor`);
        finish(1);
      }, KILL_DRAIN_MS);
    }, timeoutMs);

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearInterval(heartbeat);
      clearTimeout(timer);
      if (drainTimer) clearTimeout(drainTimer);
      reject(err);
    });

    child.on("close", (code, signal) => {
      if (signal) console.error(`[FAIL] ${label}: sinyal ${signal}`);
      finish(timedOut ? 1 : (code ?? 1));
    });
  });

  return { exitCode: exitCode.exitCode, stdout, stderr, timedOut: exitCode.timedOut };
}

/**
 * @returns {Promise<{ exitCode: number, stderr: string, stdout: string, timedOut: boolean }>}
 */
async function spawnElectronBundle(bundleOut, { env = {}, label = "Electron", timeoutMs = DEFAULT_TIMEOUT_MS, pipeOutput = false } = {}) {
  const childEnv = { ...process.env, ...env };
  for (const key of Object.keys(childEnv).filter((k) => k.startsWith("MKD_"))) {
    if (!(key in env)) delete childEnv[key];
  }

  const result = await spawnWithTimeout({
    command: electronPath,
    args: [bundleOut],
    cwd: root,
    env: childEnv,
    label,
    timeoutMs,
    pipeOutput,
  });

  return result;
}

/**
 * @param {object} opts
 */
async function runPremiumElectronEntry(opts) {
  const {
    entryTs,
    envKey,
    label = path.basename(entryTs, ".ts"),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    verifyScreenshots = [],
    screenshotDir,
    extraEnv = {},
    pipeOutput = false,
    onComplete,
    skipBuild = false,
  } = opts;

  const bundleOut = path.join(__dirname, `.premium-e2e-bundle-${path.basename(entryTs, ".ts")}.cjs`);
  const runStartedMs = Date.now();

  if (!skipBuild) {
    ensureBuilds();
    bundleEntry(entryTs, bundleOut);
  }

  const env = { [envKey]: "1", ...extraEnv };
  for (const key of Object.keys(process.env).filter((k) => k.startsWith("MKD_"))) {
    if (!(key in env)) delete env[key];
  }

  console.log(`\n=== ${label} ===`);
  console.log(`[INFO] Bundle: ${bundleOut}`);
  console.log(`[INFO] Timeout: ${timeoutMs}ms`);

  const { exitCode, stderr, stdout, timedOut } = await spawnElectronBundle(bundleOut, {
    env,
    label,
    timeoutMs,
    pipeOutput,
  });

  if (typeof onComplete === "function") {
    onComplete({ exitCode, stderr, stdout, runStartedMs, timedOut });
  }

  if (exitCode !== 0) {
    console.error(`[FAIL] ${label}: exit code ${exitCode}${timedOut ? " (timeout)" : ""}`);
    process.exit(1);
  }

  for (const rel of verifyScreenshots) {
    const filePath = path.isAbsolute(rel) ? rel : path.join(root, rel);
    if (!fs.existsSync(filePath)) {
      console.error(`[FAIL] Screenshot eksik: ${filePath}`);
      process.exit(1);
    }
    const st = fs.statSync(filePath);
    if (st.size <= 0) {
      console.error(`[FAIL] Screenshot boş: ${filePath}`);
      process.exit(1);
    }
    if (st.mtimeMs < runStartedMs - 3000) {
      console.error(`[FAIL] Screenshot bu çalıştırmada yenilenmedi: ${filePath}`);
      process.exit(1);
    }
    console.log(`[PASS] Screenshot doğrulandı: ${filePath} (${st.size} bytes)`);
  }

  if (screenshotDir) {
    const dir = path.isAbsolute(screenshotDir) ? screenshotDir : path.join(root, screenshotDir);
    if (!fs.existsSync(dir)) {
      console.error(`[FAIL] Screenshot klasörü yok: ${dir}`);
      process.exit(1);
    }
    const pngs = fs.readdirSync(dir).filter((f) => f.endsWith(".png"));
    if (pngs.length === 0) {
      console.error(`[FAIL] Screenshot klasörü boş: ${dir}`);
      process.exit(1);
    }
    for (const f of pngs) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      if (st.size <= 0 || st.mtimeMs < runStartedMs - 3000) {
        console.error(`[FAIL] Geçersiz screenshot: ${p}`);
        process.exit(1);
      }
    }
    console.log(`[PASS] ${pngs.length} screenshot doğruladı (${dir})`);
  }

  console.log(`[DONE] ${label}: başarılı (exit 0)`);
  return { exitCode, stderr, stdout };
}

module.exports = {
  runPremiumElectronEntry,
  spawnElectronBundle,
  spawnWithTimeout,
  bundleEntry,
  ensureBuilds,
  killProcessTree,
  root,
  electronPath,
  DEFAULT_TIMEOUT_MS,
  HEARTBEAT_MS,
  KILL_DRAIN_MS,
};
