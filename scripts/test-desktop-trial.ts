/**
 * Desktop trial / paid-upgrade / IPC policy tests.
 * Electron app açmaz. Production Lisans Server'a bağlanmaz.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  classifyLicenseIpcChannel,
  decideLicenseIpcAccess,
  listUnclassifiedIpcChannels,
  ALL_IPC_CHANNELS,
} from "../src/main/ipc/licenseAuthorization.policy";
import { evaluateLicenseRecord, isBusinessLicensePhase } from "../src/main/services/licenseEvaluate";
import { IPC } from "../src/shared/ipc";
import { desktopLicenseActionCta, desktopLicenseKindLabel, isPaidRenewalReminderEligible } from "../src/shared/lib/licenseExpiry";
import { TRIAL_NETWORK_REQUIRED_MESSAGE, normalizeTrialEmail, normalizeTurkishMobile } from "../src/shared/lib/trialContact";
import { normalizeLocalEmail, resolveInternalUsername, safeTrim } from "../src/shared/lib/localAuthIdentity";
import type { LocalLicenseRecord } from "../src/shared/types/license";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..", "src");

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? `: ${detail}` : ""}`);
    failed++;
  }
}

function daysFromNowIso(days: number, fromMs = Date.now()): string {
  return new Date(fromMs + days * 24 * 60 * 60 * 1000).toISOString();
}

function paidRecord(overrides: Partial<LocalLicenseRecord> = {}): LocalLicenseRecord {
  const now = Date.now();
  return {
    kind: "paid",
    licenseKey: "WTG-PAID-LEGACY-0001",
    deviceHash: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd",
    productName: "Müvekkil Kasa Defteri",
    expiresAt: daysFromNowIso(365, now),
    lastValidatedAt: daysFromNowIso(-1, now),
    offlineGraceUntil: daysFromNowIso(6, now),
    status: "ACTIVE",
    ...overrides,
  };
}

function trialRecord(overrides: Partial<LocalLicenseRecord> = {}): LocalLicenseRecord {
  const now = Date.now();
  return {
    kind: "trial",
    licenseKey: null,
    deviceHash: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd",
    productName: "Müvekkil Kasa Defteri",
    expiresAt: daysFromNowIso(7, now),
    lastValidatedAt: new Date(now).toISOString(),
    offlineGraceUntil: null,
    status: "ACTIVE",
    ...overrides,
  };
}

function testNormalization() {
  console.log("\n=== Contact normalization ===\n");
  assert(normalizeTrialEmail("  SERDAR@EXAMPLE.COM  ") === "serdar@example.com", "DESKTOP email trim/case");
  assert(normalizeTurkishMobile("0532 123 45 67") === "+905321234567", "DESKTOP phone 0532");
  assert(normalizeTurkishMobile("5321234567") === "+905321234567", "DESKTOP phone 532");
  assert(normalizeTurkishMobile("+90 532 123 45 67") === "+905321234567", "DESKTOP phone +90");
  assert(normalizeTurkishMobile("00905321234567") === "+905321234567", "DESKTOP phone 0090");
  assert(normalizeTurkishMobile("02121234567") == null, "DESKTOP landline rejected");
}

function testIpcPolicy() {
  console.log("\n=== IPC classification / enforcement ===\n");
  assert(listUnclassifiedIpcChannels().length === 0, "DESKTOP-21 all registered IPC classified");
  assert(classifyLicenseIpcChannel(IPC.license.startTrial) === "PUBLIC", "startTrial PUBLIC");
  assert(classifyLicenseIpcChannel(IPC.license.activate) === "PUBLIC", "activate PUBLIC");
  assert(classifyLicenseIpcChannel(IPC.auth.setupFirst) === "SETUP", "setupFirst SETUP");
  assert(classifyLicenseIpcChannel(IPC.muvekkil.ekle) === "LICENSED", "muvekkil:ekle LICENSED");
  assert(classifyLicenseIpcChannel(IPC.dosya.ekle) === "LICENSED", "dosya:ekle LICENSED");
  assert(classifyLicenseIpcChannel(IPC.kasa.ekle) === "LICENSED", "kasa:ekle LICENSED");
  assert(classifyLicenseIpcChannel(IPC.backup.al) === "LICENSED", "backup LICENSED");
  assert(classifyLicenseIpcChannel("unknown:privileged") === "UNKNOWN", "unknown fail-closed class");
  assert(ALL_IPC_CHANNELS.includes(IPC.license.startTrial), "startTrial registered");

  const noAuth = { businessAuthorized: false, setupAuthorized: false, hasSession: false };
  const pendingSetup = { businessAuthorized: false, setupAuthorized: true, hasSession: false };
  const trialOk = { businessAuthorized: true, setupAuthorized: true, hasSession: true };
  const paidOk = { businessAuthorized: true, setupAuthorized: true, hasSession: true };
  const spoofedRenderer = { businessAuthorized: false, setupAuthorized: false, hasSession: true };

  assert(decideLicenseIpcAccess(IPC.license.getState, noAuth) === "ALLOW", "PUBLIC license state without license");
  assert(decideLicenseIpcAccess(IPC.auth.setupFirst, pendingSetup) === "ALLOW", "SETUP allowed after trial grant");
  assert(decideLicenseIpcAccess(IPC.auth.setupFirst, noAuth) === "DENY", "SETUP denied without grant");
  assert(decideLicenseIpcAccess(IPC.muvekkil.ekle, noAuth) === "DENY", "DESKTOP-17 no session/license DENY");
  assert(decideLicenseIpcAccess(IPC.muvekkil.ekle, spoofedRenderer) === "DENY", "DESKTOP-16 renderer spoof DENY");
  assert(decideLicenseIpcAccess(IPC.muvekkil.ekle, pendingSetup) === "DENY", "pending setup cannot open business IPC");
  assert(decideLicenseIpcAccess(IPC.muvekkil.ekle, trialOk) === "ALLOW", "DESKTOP-18 active trial ALLOW");
  assert(decideLicenseIpcAccess(IPC.kasa.ekle, paidOk) === "ALLOW", "DESKTOP-19 paid active ALLOW");
  assert(decideLicenseIpcAccess("unknown:privileged", trialOk) === "DENY", "DESKTOP-21 unknown fail-closed DENY");
}

function testLicensePhases() {
  console.log("\n=== License phase model ===\n");
  const none = evaluateLicenseRecord(null, { lastTrialOnlineOk: false, lastOfflineDegraded: false });
  assert(none.phase === "needsActivation" && none.needsActivation, "DESKTOP-01 no license → choice/needsActivation");

  const trialOnline = evaluateLicenseRecord(trialRecord(), { lastTrialOnlineOk: true, lastOfflineDegraded: false });
  assert(trialOnline.phase === "trialActive" && trialOnline.valid, "DESKTOP-07 trial online → business", trialOnline.phase);
  assert(isBusinessLicensePhase(trialOnline.phase), "trialActive is licensed");

  const trialNet = evaluateLicenseRecord(trialRecord(), { lastTrialOnlineOk: false, lastOfflineDegraded: true });
  assert(trialNet.phase === "trialNetworkRequired", "DESKTOP-08 trial network-required", trialNet.phase);
  assert(trialNet.message === TRIAL_NETWORK_REQUIRED_MESSAGE, "DESKTOP-08 network message", trialNet.message ?? "");
  assert(!trialNet.valid, "DESKTOP-14 trial never uses paid grace");
  assert(trialNet.phase !== "paidOfflineGrace", "DESKTOP-14 trial != paidOfflineGrace");

  const trialExp = evaluateLicenseRecord(
    trialRecord({ expiresAt: "2026-01-01T00:00:00.000Z" }),
    { lastTrialOnlineOk: true, lastOfflineDegraded: false },
    Date.parse("2026-01-15T10:00:00.000Z"),
  );
  assert(trialExp.phase === "trialExpired" && trialExp.locked, "DESKTOP-09 trial expired gate");

  const paid = evaluateLicenseRecord(paidRecord(), { lastTrialOnlineOk: false, lastOfflineDegraded: false });
  assert(paid.phase === "paidActive" && paid.valid && !paid.needsActivation, "DESKTOP-22 paid startup continues", paid.phase);

  const paidNow = Date.now();
  const paidGrace = evaluateLicenseRecord(
    paidRecord({ offlineGraceUntil: daysFromNowIso(5, paidNow) }),
    { lastTrialOnlineOk: false, lastOfflineDegraded: true },
    paidNow,
  );
  assert(paidGrace.phase === "paidOfflineGrace" && paidGrace.valid, "DESKTOP-12 paid grace allowed", paidGrace.phase);
  assert(isBusinessLicensePhase(paidGrace.phase), "DESKTOP-20 paid offline grace ALLOW");

  const paidGraceGone = evaluateLicenseRecord(
    paidRecord({ offlineGraceUntil: daysFromNowIso(-1, paidNow) }),
    { lastTrialOnlineOk: false, lastOfflineDegraded: true },
    paidNow,
  );
  assert(paidGraceGone.phase === "locked" && !paidGraceGone.valid, "DESKTOP-13 paid grace expired locked");
}

function reminderEligible(state: ReturnType<typeof evaluateLicenseRecord>, needsSetup = false) {
  return isPaidRenewalReminderEligible({
    valid: state.valid,
    kind: state.record?.kind,
    warningThreshold: state.warningThreshold,
    needsSetup,
  });
}

function testRenewalReminder() {
  console.log("\n=== Paid vs trial renewal reminder ===\n");
  const now = Date.now();
  const flagsOk = { lastTrialOnlineOk: true, lastOfflineDegraded: false };
  const paidFlags = { lastTrialOnlineOk: false, lastOfflineDegraded: false };

  const trial7 = evaluateLicenseRecord(trialRecord({ expiresAt: daysFromNowIso(7, now) }), flagsOk, now);
  assert(trial7.phase === "trialActive" && trial7.warningThreshold == null, "1 trial +7d warningThreshold null");
  assert(!reminderEligible(trial7), "1 trial ACTIVE +7d paid renewal false");

  const trial1 = evaluateLicenseRecord(trialRecord({ expiresAt: daysFromNowIso(1, now) }), flagsOk, now);
  assert(trial1.phase === "trialActive" && trial1.warningThreshold == null, "2 trial +1d warningThreshold null");
  assert(!reminderEligible(trial1), "2 trial ACTIVE +1d paid renewal false");

  const trialExp = evaluateLicenseRecord(trialRecord({ expiresAt: daysFromNowIso(-1, now) }), flagsOk, now);
  assert(trialExp.phase === "trialExpired" && !trialExp.valid, "3 trial expired → gate, not reminder");
  assert(!reminderEligible(trialExp), "3 trial expired paid renewal false");

  const paid7 = evaluateLicenseRecord(paidRecord({ expiresAt: daysFromNowIso(7, now) }), paidFlags, now);
  assert(paid7.phase === "paidActive" && paid7.warningThreshold === 7, "4 paid +7d threshold 7");
  assert(reminderEligible(paid7), "4 paid + threshold → reminder true");

  const paidFar = evaluateLicenseRecord(paidRecord({ expiresAt: daysFromNowIso(200, now) }), paidFlags, now);
  assert(paidFar.phase === "paidActive" && paidFar.warningThreshold == null, "5 paid outside threshold");
  assert(!reminderEligible(paidFar), "5 paid far from expiry → no reminder");

  assert(!reminderEligible(paid7, true), "6 first setup userCount=0 hides reminder");
  assert(!reminderEligible(trial7, true), "6 trial + first setup still no paid reminder");

  const afterPaid = evaluateLicenseRecord(
    paidRecord({ expiresAt: daysFromNowIso(7, now), licenseKey: "WTG-PAID-AFTER-TRIAL" }),
    paidFlags,
    now,
  );
  assert(afterPaid.record?.kind === "paid" && reminderEligible(afterPaid), "7 trial→paid reminder rules apply");
}

function testUiParity() {
  console.log("\n=== Renderer UX smoke ===\n");
  const premiumChoice = readFileSync(join(srcRoot, "renderer-premium/pages/license/LicenseChoicePage.tsx"), "utf8");
  const legacyChoice = readFileSync(join(srcRoot, "renderer/pages/license/LicenseChoicePage.tsx"), "utf8");
  const premiumTrial = readFileSync(join(srcRoot, "renderer-premium/pages/license/LicenseTrialSetupPage.tsx"), "utf8");
  const legacyTrial = readFileSync(join(srcRoot, "renderer/pages/license/LicenseTrialSetupPage.tsx"), "utf8");
  const premiumSetup = readFileSync(join(srcRoot, "renderer-premium/pages/auth/SetupPage.tsx"), "utf8");
  const legacySetup = readFileSync(join(srcRoot, "renderer/pages/auth/SetupPage.tsx"), "utf8");
  const premiumLogin = readFileSync(join(srcRoot, "renderer-premium/pages/auth/LoginPage.tsx"), "utf8");
  const legacyLogin = readFileSync(join(srcRoot, "renderer/pages/auth/LoginPage.tsx"), "utf8");
  const premiumForgot = readFileSync(join(srcRoot, "renderer-premium/pages/auth/ForgotPasswordPage.tsx"), "utf8");
  const legacyForgot = readFileSync(join(srcRoot, "renderer/pages/auth/ForgotPasswordPage.tsx"), "utf8");
  const premiumGate = readFileSync(join(srcRoot, "renderer-premium/app/PremiumLicenseGate.tsx"), "utf8");
  const legacyGate = readFileSync(join(srcRoot, "renderer/components/LicenseGateRoute.tsx"), "utf8");

  assert(premiumChoice.includes("7 Gün Ücretsiz Dene") && premiumChoice.includes("Lisansımı Etkinleştir"), "DESKTOP-01/23 premium choice");
  assert(legacyChoice.includes("7 Gün Ücretsiz Dene") && legacyChoice.includes("Lisansımı Etkinleştir"), "DESKTOP-01/24 legacy choice");
  assert(premiumTrial.includes("licenseStartTrial") && premiumTrial.includes("setupFirst"), "DESKTOP-03 premium central-first");
  assert(legacyTrial.includes("licenseStartTrial") && legacyTrial.includes("setupFirst"), "DESKTOP-03 legacy central-first");
  assert(premiumTrial.indexOf("licenseStartTrial") < premiumTrial.indexOf("setupFirst("), "DESKTOP-03 central before local");
  const authService = readFileSync(join(srcRoot, "main/services/auth.service.ts"), "utf8");
  const licenseService = readFileSync(join(srcRoot, "main/services/license.service.ts"), "utf8");
  const bootHint = readFileSync(join(srcRoot, "renderer-premium/lib/bootErrorHint.ts"), "utf8");
  assert(!authService.includes("input.kullaniciAdi.trim()"), "setupFirst does not trim missing kullaniciAdi");
  assert(authService.includes("safeTrim(input.adSoyad)"), "setupFirst uses safeTrim");
  const startFn = licenseService.slice(licenseService.indexOf("export async function licenseStartTrial"), licenseService.indexOf("export async function licenseActivate"));
  assert(startFn.includes("saveLocalLicense({") && startFn.indexOf("saveLocalLicense({") < startFn.indexOf("resumed: out.resumed"), "E trial persist happens before startTrial returns");
  assert(bootHint.includes("import.meta.env.DEV") && bootHint.includes("npm run dev:premium"), "fatal hint is DEV-only");
  assert(premiumTrial.includes("} catch (err)"), "trial page catches setupFirst throw");
  assert(!premiumTrial.includes("Kullanıcı adı") && !legacyTrial.includes("Kullanıcı adı"), "1 trial UX has no username field");
  assert(!premiumSetup.includes("Kullanıcı adı") && !legacySetup.includes("Kullanıcı adı"), "6 paid setup UX has no username field");
  assert(
    premiumLogin.includes('label="E-posta veya Kullanıcı Adı"') && legacyLogin.includes(">E-posta veya Kullanıcı Adı<"),
    "login label is dual identity",
  );
  assert(
    premiumLogin.includes("E-posta veya kullanıcı adınızı girin") && legacyLogin.includes("E-posta veya kullanıcı adınızı girin"),
    "login placeholder is dual identity",
  );
  assert(
    premiumForgot.includes('label="E-posta veya Kullanıcı Adı"') && legacyForgot.includes(">E-posta veya Kullanıcı Adı<"),
    "8 forgot-password dual identity label",
  );
  assert(
    premiumForgot.includes("E-posta veya kullanıcı adınızı girin.") && legacyForgot.includes("E-posta veya kullanıcı adınızı girin."),
    "8 forgot-password dual identity copy",
  );
  assert(premiumTrial.includes('label="E-posta"') && legacyTrial.includes(">E-posta<"), "trial setup keeps real email label");
  assert(authService.includes("findUserRowByLoginIdentity") && authService.includes("LOCAL_AUTH_IDENTITY_EMPTY_ERROR"), "login/forgot identity-neutral errors");
  assert(!authService.includes("E-posta boş olamaz."), "auth.service has no email-only empty error");
  assert(premiumGate.includes("trialNetworkRequired") && premiumGate.includes("Tekrar Dene"), "DESKTOP-08 premium network UX");
  assert(legacyGate.includes("trialNetworkRequired") && legacyGate.includes("Tekrar Dene"), "DESKTOP-08 legacy network UX");
  assert(premiumGate.includes("7 günlük ücretsiz deneme süreniz sona erdi."), "DESKTOP-09 premium expired UX");
  assert(legacyGate.includes("7 günlük ücretsiz deneme süreniz sona erdi."), "DESKTOP-09 legacy expired UX");
  const premiumShell = readFileSync(join(srcRoot, "renderer-premium/components/license/PremiumLicenseStatusShell.tsx"), "utf8");
  const legacyShell = readFileSync(join(srcRoot, "renderer/components/license/LicenseStatusShell.tsx"), "utf8");
  assert(premiumShell.includes("!needsSetup") && legacyShell.includes("!needsSetup"), "6 reminder hidden during first setup");
  const evaluateSrc = readFileSync(join(srcRoot, "main/services/licenseEvaluate.ts"), "utf8");
  assert(evaluateSrc.includes('record?.kind === "paid"') && evaluateSrc.includes("pickWarningThreshold"), "trial/paid warningThreshold split");
}

function testSettingsLicenseCta() {
  console.log("\n=== Settings license CTA (trial vs paid) ===\n");
  assert(desktopLicenseKindLabel("trial") === "7 Günlük Ücretsiz Deneme", "trial kind label");
  assert(desktopLicenseKindLabel("paid") === "Yıllık Lisans", "paid kind label");
  assert(desktopLicenseKindLabel(null) == null && desktopLicenseKindLabel(undefined) == null, "unknown kind has no label");
  assert(desktopLicenseActionCta("trial") === "upgrade", "trial CTA is upgrade");
  assert(desktopLicenseActionCta("paid") === "renew", "paid CTA is renew");
  assert(desktopLicenseActionCta(null) == null, "unknown kind has no CTA");

  const trialState = evaluateLicenseRecord(trialRecord({ expiresAt: daysFromNowIso(7) }), {
    lastTrialOnlineOk: true,
    lastOfflineDegraded: false,
  });
  assert(trialState.phase === "trialActive" && trialState.daysRemaining === 7, "trial ACTIVE remaining days 7");
  assert(!reminderEligible(trialState), "trial ACTIVE: paid renewal modal false");
  assert(desktopLicenseActionCta(trialState.record?.kind) === "upgrade", "trial ACTIVE: Tam Sürüme Geç");
  assert(desktopLicenseActionCta(trialState.record?.kind) !== "renew", "trial ACTIVE: Lisansı yenile yok");

  const paidState = evaluateLicenseRecord(paidRecord(), { lastTrialOnlineOk: false, lastOfflineDegraded: false });
  assert(paidState.phase === "paidActive", "paid ACTIVE");
  assert(desktopLicenseActionCta(paidState.record?.kind) === "renew", "paid ACTIVE: Lisansı yenile");
  assert(desktopLicenseActionCta(paidState.record?.kind) !== "upgrade", "paid ACTIVE: Tam Sürüme Geç yok");

  const afterUpgrade = evaluateLicenseRecord(
    paidRecord({ licenseKey: "WTG-PAID-AFTER-TRIAL" }),
    { lastTrialOnlineOk: false, lastOfflineDegraded: false },
  );
  assert(afterUpgrade.record?.kind === "paid" && desktopLicenseActionCta(afterUpgrade.record.kind) === "renew", "trial→paid UI switches to yenile");
  assert(desktopLicenseKindLabel(afterUpgrade.record?.kind) === "Yıllık Lisans", "trial→paid kind label is Yıllık Lisans");

  const premiumSettings = readFileSync(join(srcRoot, "renderer-premium/components/settings/SettingsLicenseSection.tsx"), "utf8");
  const legacyOffice = readFileSync(join(srcRoot, "renderer/pages/settings/OfficeSettingsPage.tsx"), "utf8");
  const premiumRouter = readFileSync(join(srcRoot, "renderer-premium/app/PremiumRouter.tsx"), "utf8");
  const legacyApp = readFileSync(join(srcRoot, "renderer/App.tsx"), "utf8");
  const premiumProtected = readFileSync(join(srcRoot, "renderer-premium/app/PremiumProtectedRoute.tsx"), "utf8");
  const licenseService = readFileSync(join(srcRoot, "main/services/license.service.ts"), "utf8");

  assert(premiumSettings.includes("Tam Sürüme Geç") && legacyOffice.includes("Tam Sürüme Geç"), "trial CTA label in premium+legacy");
  assert(premiumSettings.includes('actionCta === "renew"') && premiumSettings.includes("Lisansı yenile"), "paid yenile gated on renew");
  assert(premiumSettings.includes('actionCta === "upgrade"'), "trial upgrade gated");
  assert(legacyOffice.includes('desktopLicenseActionCta(licenseState?.record?.kind) === "renew"'), "legacy paid yenile gated");
  assert(legacyOffice.includes('desktopLicenseActionCta(licenseState?.record?.kind) === "upgrade"'), "legacy trial upgrade gated");
  assert(premiumSettings.includes("Lisansı kontrol et") && legacyOffice.includes("Lisansı kontrol et"), "kontrol et stays");
  assert(premiumSettings.includes("Lisans türü") && legacyOffice.includes("Lisans türü"), "kind row shown");
  assert(premiumSettings.includes('navigate("/lisans/yukselt")') && legacyOffice.includes('navigate("/lisans/yukselt")'), "upgrade opens in-app activate");
  assert(!premiumSettings.includes("koopplus") && !legacyOffice.includes("koopplus"), "no KoopPlus URL");
  assert(!premiumSettings.includes("woontegra.com/yazilimlar") && !legacyOffice.includes("woontegra.com/yazilimlar"), "no invented product URL");
  assert(premiumRouter.includes('path="/lisans/yukselt"') && legacyApp.includes('path="/lisans/yukselt"'), "upgrade route exists");
  assert(premiumRouter.includes("PremiumProtectedRoute") && premiumRouter.indexOf("PremiumProtectedRoute") < premiumRouter.indexOf("/lisans/yukselt"), "upgrade is behind protected route");
  assert(premiumProtected.includes("needsSetup") && premiumProtected.includes('to="/setup"'), "first setup cannot reach upgrade CTA");

  const validateFn = licenseService.slice(licenseService.indexOf("export async function licenseValidate"));
  assert(validateFn.includes('record.kind === "trial"') && validateFn.includes("return licenseValidateTrial(record)"), "trial validate branch");
  assert(validateFn.indexOf("licenseValidateTrial") < validateFn.indexOf('"/validate"'), "trial does not fall through to paid /validate");
  assert(licenseService.includes('"/trial/validate"') && licenseService.includes('"/validate"'), "trial+paid validate endpoints present");
  assert(licenseService.includes("if (!record?.licenseKey)"), "renewal-link requires licenseKey (trial skipped)");
}

function testEmailIdentity() {
  console.log("\n=== Local email identity ===\n");
  assert(normalizeLocalEmail(" Test@Example.com ") === "test@example.com", "normalize trim+lowercase");
  const created = resolveInternalUsername({ eposta: " Test@Example.com " });
  assert(created.ok && created.kullaniciAdi === "test@example.com" && created.eposta === "test@example.com", "2 internal username = email");
  const legacy = resolveInternalUsername({ kullaniciAdi: "eskiadmin" });
  assert(legacy.ok && legacy.kullaniciAdi === "eskiadmin" && legacy.eposta === null, "10 legacy username fallback");
  const missing = resolveInternalUsername({});
  assert(!missing.ok, "new account requires email");
  const bad = resolveInternalUsername({ eposta: "not-an-email" });
  assert(!bad.ok, "invalid email rejected");
  assert(safeTrim(undefined) === "" && safeTrim(null) === "", "safeTrim undefined/null");
  let threw = false;
  try {
    resolveInternalUsername({ eposta: undefined, kullaniciAdi: undefined });
  } catch {
    threw = true;
  }
  const empty = resolveInternalUsername({ eposta: undefined, kullaniciAdi: undefined });
  assert(!threw && !empty.ok, "D undefined identity → validation, no TypeError");
  const emailOnly = resolveInternalUsername({ eposta: " A@B.com ", kullaniciAdi: undefined });
  assert(emailOnly.ok && emailOnly.kullaniciAdi === "a@b.com", "A kullaniciAdi undefined + email ok");
}

function testLegacyPaidUpgrade() {
  console.log("\n=== Legacy paid DB upgrade (RELEASE BLOCKER) ===\n");
  const migration014 = readFileSync(join(srcRoot, "main/migrations/014_license_trial.ts"), "utf8");
  assert(migration014.includes("DEFAULT 'paid'"), "014 defaults kind=paid");
  assert(migration014.includes("kind IN ('paid', 'trial')"), "014 kind check");
  assert(!migration014.includes("DELETE FROM muvekkil"), "014 does not touch business rows");

  const upgraded = evaluateLicenseRecord(
    {
      kind: "paid",
      licenseKey: "WTG-PAID-LEGACY-0001",
      deviceHash: "abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd",
      productName: "Müvekkil Kasa Defteri",
      expiresAt: "2027-06-01T00:00:00.000Z",
      lastValidatedAt: "2026-01-14T10:00:00.000Z",
      offlineGraceUntil: "2026-01-21T10:00:00.000Z",
      status: "ACTIVE",
    },
    { lastTrialOnlineOk: false, lastOfflineDegraded: false },
    Date.parse("2026-01-16T10:00:00.000Z"),
  );
  assert(upgraded.phase === "paidActive" && upgraded.valid && !upgraded.needsActivation, "L/N/O paid startup after kind=paid");

  const electronDir = join(here, "..", "node_modules", "electron");
  const pathTxt = join(electronDir, "path.txt");
  if (!existsSync(pathTxt)) {
    assert(false, "electron binary missing for sqlite upgrade fixture");
    return;
  }
  const executablePath = readFileSync(pathTxt, "utf8").trim();
  const electronPath = join(electronDir, "dist", executablePath);
  const run = spawnSync(electronPath, [join(here, "test-legacy-paid-upgrade.cjs")], {
    cwd: join(here, ".."),
    encoding: "utf8",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);
  assert(run.status === 0, "legacy paid sqlite fixture via Electron ABI");

  const emailLogin = spawnSync(electronPath, [join(here, "test-email-login.cjs")], {
    cwd: join(here, ".."),
    encoding: "utf8",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  if (emailLogin.stdout) process.stdout.write(emailLogin.stdout);
  if (emailLogin.stderr) process.stderr.write(emailLogin.stderr);
  assert(emailLogin.status === 0, "email login / legacy username sqlite fixture");

  const paidLogin = spawnSync(electronPath, [join(here, "test-legacy-paid-login.cjs")], {
    cwd: join(here, ".."),
    encoding: "utf8",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  if (paidLogin.stdout) process.stdout.write(paidLogin.stdout);
  if (paidLogin.stderr) process.stderr.write(paidLogin.stderr);
  assert(paidLogin.status === 0, "RELEASE BLOCKER legacy paid username login / forgot");
}

function main() {
  console.log("\n=== MK Desktop trial/paid unit tests ===");
  testNormalization();
  testEmailIdentity();
  testIpcPolicy();
  testLicensePhases();
  testRenewalReminder();
  testSettingsLicenseCta();
  testUiParity();
  testLegacyPaidUpgrade();
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
