/**
 * Cihaz kimliği regresyon testi (Electron açmaz, ağ/DB kullanmaz).
 * - Windows/darwin dışı formül HEAD sürümüyle birebir aynı mı
 * - macOS IOPlatformUUID tabanlı kimlik kararlı mı, farklı UUID farklı hash üretir mi
 * - IOPlatformUUID okunamazsa hostname'e geri dönmeden hata verilir mi
 * Gerçek donanım kimliği ve hash değeri ekrana yazılmaz.
 * Çalıştırma: node scripts/test-device-hash.mjs
 */
import { execFileSync } from "node:child_process";
import childProcess from "node:child_process";
import { buildSync } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const servicePath = "src/main/services/deviceHash.service.ts";
const HEX64 = /^[0-9a-f]{64}$/;

let passed = 0;
let failed = 0;
function assert(cond, name) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
  }
}

function bundle(entry, outfile) {
  buildSync({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile, logLevel: "error" });
}

const tmp = mkdtempSync(join(os.tmpdir(), "mkd-device-hash-"));
const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
const originalOs = { hostname: os.hostname, platform: os.platform, arch: os.arch };
const originalEnv = { COMPUTERNAME: process.env.COMPUTERNAME, PROCESSOR_IDENTIFIER: process.env.PROCESSOR_IDENTIFIER };
const originalExecFileSync = childProcess.execFileSync;

function setProcessPlatform(value) {
  Object.defineProperty(process, "platform", { ...originalPlatform, value });
}
function setEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
function restoreAll() {
  Object.defineProperty(process, "platform", originalPlatform);
  Object.assign(os, originalOs);
  setEnv("COMPUTERNAME", originalEnv.COMPUTERNAME);
  setEnv("PROCESSOR_IDENTIFIER", originalEnv.PROCESSOR_IDENTIFIER);
  childProcess.execFileSync = originalExecFileSync;
  syncBuiltinESMExports();
}

try {
  const oldSrc = join(tmp, "deviceHash.old.ts");
  writeFileSync(oldSrc, execFileSync("git", ["show", `HEAD:${servicePath}`], { cwd: root, encoding: "utf8" }));
  bundle(oldSrc, join(tmp, "old.mjs"));
  bundle(join(root, servicePath), join(tmp, "new.mjs"));
  const oldMod = await import(pathToFileURL(join(tmp, "old.mjs")).href);
  const newMod = await import(pathToFileURL(join(tmp, "new.mjs")).href);

  console.log("Windows / darwin dışı formül (HEAD ile birebir)");
  const windowsSamples = [
    { hostname: "DESKTOP-ABC123", arch: "x64", COMPUTERNAME: "DESKTOP-ABC123", PROCESSOR_IDENTIFIER: "Intel64 Family 6 Model 154 Stepping 3, GenuineIntel" },
    { hostname: "BÜRO-PC", arch: "x64", COMPUTERNAME: "BÜRO-PC", PROCESSOR_IDENTIFIER: "AMD64 Family 25 Model 33 Stepping 0, AuthenticAMD" },
    { hostname: "SURFACE", arch: "arm64", COMPUTERNAME: "SURFACE", PROCESSOR_IDENTIFIER: "ARMv8 (64-bit) Family 8 Model 1 Revision 201, Qualcomm" },
    { hostname: "PC", arch: "ia32", COMPUTERNAME: undefined, PROCESSOR_IDENTIFIER: undefined },
  ];
  for (const s of windowsSamples) {
    setProcessPlatform("win32");
    Object.assign(os, { hostname: () => s.hostname, platform: () => "win32", arch: () => s.arch });
    setEnv("COMPUTERNAME", s.COMPUTERNAME);
    setEnv("PROCESSOR_IDENTIFIER", s.PROCESSOR_IDENTIFIER);
    const oldHash = oldMod.computeDeviceHash();
    const newHash = newMod.computeDeviceHash();
    const pureHash = newMod.computeLegacyDeviceHash({
      hostname: s.hostname,
      platform: "win32",
      arch: s.arch,
      computerName: s.COMPUTERNAME ?? "",
      processorIdentifier: s.PROCESSOR_IDENTIFIER ?? "",
    });
    assert(oldHash === newHash && newHash === pureHash && HEX64.test(newHash), `win32 ${s.hostname}/${s.arch}: eski = yeni`);
    assert(newMod.getPlatformLabel() === `win32-${s.arch}`, `win32 ${s.hostname}: platform etiketi değişmedi`);
    assert(newMod.getDeviceName() === oldMod.getDeviceName(), `win32 ${s.hostname}: cihaz adı değişmedi`);
  }
  setProcessPlatform("linux");
  Object.assign(os, { hostname: () => "linux-box", platform: () => "linux", arch: () => "x64" });
  assert(oldMod.computeDeviceHash() === newMod.computeDeviceHash(), "linux: eski = yeni (darwin dışı formül korunuyor)");
  restoreAll();

  console.log("macOS IOPlatformUUID kimliği");
  const fixtureA = "11111111-2222-3333-4444-555555555555";
  const fixtureB = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";
  const ioregSample = (uuid) =>
    `+-o J413AP  <class IOPlatformExpertDevice>\n    {\n      "IOPlatformSerialNumber" = "X"\n      "IOPlatformUUID" = "${uuid}"\n    }\n`;
  assert(newMod.parseIoPlatformUuid(ioregSample(fixtureA)) === fixtureA, "ioreg çıktısından UUID ayrıştırılıyor");
  assert(newMod.parseIoPlatformUuid(ioregSample(fixtureA.toLowerCase())) === fixtureA, "küçük harfli UUID normalize ediliyor");
  assert(newMod.parseIoPlatformUuid('"IOPlatformSerialNumber" = "X"') === null, "UUID yoksa null");
  assert(newMod.parseIoPlatformUuid(ioregSample("not-a-uuid")) === null, "geçersiz UUID reddediliyor");
  assert(newMod.parseIoPlatformUuid(ioregSample("00000000-0000-0000-0000-000000000000")) === null, "sıfır UUID reddediliyor");

  const hashA = newMod.computeMacDeviceHash(fixtureA);
  const hashA2 = newMod.computeMacDeviceHash(fixtureA.toLowerCase());
  const hashB = newMod.computeMacDeviceHash(fixtureB);
  assert(HEX64.test(hashA) && HEX64.test(hashB), "64 karakter küçük harfli hex");
  assert(hashA === hashA2, "aynı UUID → aynı hash");
  assert(hashA !== hashB, "farklı UUID → farklı hash");
  assert(!hashA.includes(fixtureA.toLowerCase().replace(/-/g, "")), "hash UUID'yi açık metin içermiyor");
  let threwOnEmpty = false;
  try {
    newMod.computeMacDeviceHash("");
  } catch (e) {
    threwOnEmpty = e instanceof newMod.DeviceIdentityUnavailableError;
  }
  assert(threwOnEmpty, "boş UUID → DeviceIdentityUnavailableError");

  if (process.platform === "darwin") {
    const real1 = newMod.computeDeviceHash();
    const real2 = newMod.computeDeviceHash();
    assert(HEX64.test(real1), "bu Mac: 64 karakter küçük harfli hex");
    assert(real1 === real2, "bu Mac: tekrar hesaplamada aynı kimlik");
    assert(real1 !== oldMod.computeDeviceHash(), "bu Mac: hostname tabanlı eski kimlikten farklı");

    const savedHostname = os.hostname;
    os.hostname = () => "Baska-Isim-MacBook.local";
    assert(newMod.computeDeviceHash() === real1, "bu Mac: bilgisayar adı değişse de kimlik aynı");
    os.hostname = savedHostname;

    const failures = [
      ["ioreg çalıştırılamadı", () => { throw new Error("spawn failed"); }],
      ["ioreg çıktısında UUID yok", () => '"IOPlatformSerialNumber" = "X"\n'],
      ["ioreg sıfır UUID döndü", () => ioregSample("00000000-0000-0000-0000-000000000000")],
    ];
    for (const [label, impl] of failures) {
      childProcess.execFileSync = impl;
      syncBuiltinESMExports();
      let result = "no-throw";
      try {
        newMod.computeDeviceHash();
      } catch (e) {
        result = e instanceof newMod.DeviceIdentityUnavailableError ? "device-error" : "other-error";
      }
      assert(result === "device-error", `${label}: hostname'e dönmeden DeviceIdentityUnavailableError`);
    }
    restoreAll();
  } else {
    console.log("  - Gerçek Mac kontrolleri atlandı (darwin değil)");
  }
} finally {
  restoreAll();
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${passed} geçti, ${failed} başarısız`);
process.exit(failed === 0 ? 0 : 1);
