/**
 * Runner timeout + taskkill doğrulaması (parity/legacy akışı başlatmaz).
 * Askıda kalan Node child → 10s timeout → taskkill → exit 1.
 */
const { spawnWithTimeout, killProcessTree } = require("./lib/premium-e2e-runner.cjs");

const SMOKE_TIMEOUT_MS = 10000;
const started = Date.now();

async function main() {
  console.log(`[SMOKE] Askıda child başlatılıyor (timeout=${SMOKE_TIMEOUT_MS}ms)…`);
  const { exitCode, timedOut } = await spawnWithTimeout({
    command: process.execPath,
    args: ["-e", "setInterval(() => {}, 2147483647)"],
    label: "timeout-smoke-child",
    timeoutMs: SMOKE_TIMEOUT_MS,
  });

  const elapsed = Date.now() - started;
  if (!timedOut || exitCode !== 1) {
    console.error(`[FAIL] Beklenen timeout exit 1, alınan exit=${exitCode} timedOut=${timedOut}`);
    process.exit(1);
  }
  if (elapsed > 15000) {
    console.error(`[FAIL] Smoke ${elapsed}ms sürdü (>15000ms)`);
    process.exit(1);
  }
  console.log(`[PASS] Timeout smoke ${elapsed}ms — exit 1, timedOut=true`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  killProcessTree(process.pid);
  process.exit(1);
});
