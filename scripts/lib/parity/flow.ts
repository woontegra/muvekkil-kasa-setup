import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { BrowserWindow } from "electron";
import { PARITY, PARITY_OUT } from "./constants";
import {
  attachFlowConsole,
  clickByText,
  clickConfirmIfOpen,
  clickLegacyNav,
  clickRowLink,
  clickSidebar,
  closeModal,
  doubleSubmit,
  exerciseInput,
  installDialogAutoAccept,
  setInput,
  setSelect,
  waitHome,
  waitToast,
  type ConsoleBag,
  type FlowRenderer,
  PARITY_SET_VALUE_SNIPPET,
} from "./ui";
import {
  assert,
  js,
  loadPremiumRoute,
  sleep,
  waitForSelector,
} from "../premium-e2e-harness";
import {
  loadLegacyBoot,
  probeLegacyScreen,
} from "./legacy-screen";
import { runStep } from "./step";

export type VisibleSnapshot = Record<string, unknown>;

export type FlowResult = {
  renderer: FlowRenderer;
  console: ConsoleBag;
  inputChecks: string[];
  visible: VisibleSnapshot;
};

function pass(step: string): void {
  console.log(`[PASS] ${step}`);
}

async function loginLegacy(win: BrowserWindow): Promise<void> {
  const wc = win.webContents;
  await loadLegacyBoot(win, "/login");
  const deadline = Date.now() + 40_000;
  let screen = await probeLegacyScreen(wc);
  while (Date.now() < deadline) {
    if (screen.screen === "home" || screen.selectors.home) {
      return;
    }
    if (screen.screen === "login" || screen.selectors.login) break;
    if (screen.screen === "setup") {
      throw new Error("Setup ekranı açık — bootstrap DB kullanıcısı eksik olabilir");
    }
    if (screen.screen === "license-activate" || screen.screen === "license-locked") {
      throw new Error(`Lisans ekranı: ${screen.screen}`);
    }
    await sleep(300);
    screen = await probeLegacyScreen(wc);
  }
  if (screen.screen !== "login" && !screen.selectors.login) {
    throw new Error(`Login ekranı yok: screen=${screen.screen} hash=${screen.hash} body=${screen.bodySnippet.slice(0, 120)}`);
  }
  await js(
    wc,
    `(function() {
      const inputs = document.querySelectorAll('.auth-card input');
      const set = (el, v) => {
        const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        d?.set?.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set(inputs[0], ${JSON.stringify(PARITY.user)});
      set(inputs[1], ${JSON.stringify(PARITY.pass)});
    })()`,
  );
  await doubleSubmit(wc, '.auth-card button[type="submit"]');
  const shellOk = await waitForSelector(wc, ".desk-home-dashboard", 15_000);
  assert(shellOk, "Giriş sonrası ana sayfa yok");
}

async function login(win: BrowserWindow, renderer: FlowRenderer): Promise<void> {
  if (renderer === "legacy") {
    await loginLegacy(win);
    return;
  }
  const wc = win.webContents;
  await loadPremiumRoute(win, "/login", ".pm-login-panel");
  await js(
    wc,
    `(() => {
      function set(el, v) {
        const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        d?.call(el, v);
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }
      set(document.querySelector('.pm-login-form input[autocomplete="username"]'), ${JSON.stringify(PARITY.user)});
      set(document.querySelector('.pm-login-form input[autocomplete="current-password"]'), ${JSON.stringify(PARITY.pass)});
    })()`,
  );
  await doubleSubmit(wc, ".pm-login-submit");
  const shellOk = await waitForSelector(wc, ".pm-shell", 30_000);
  assert(shellOk, "Giriş sonrası shell yok");
}

async function openMuvekkilCreate(win: BrowserWindow, renderer: FlowRenderer): Promise<void> {
  const wc = win.webContents;
  if (renderer === "legacy") {
    await clickLegacyNav(wc, "#/");
    await waitHome(wc, renderer);
    await js(wc, `document.querySelector('.desk-home-search-btn')?.click()`);
    await waitForSelector(wc, "#form-muvekkil", 8000);
  } else {
    await clickSidebar(wc, "Müvekkiller");
    await waitForSelector(wc, ".pm-muvekkiller-page", 15000);
    await clickByText(wc, /Yeni [Mm]üvekkil/);
    await waitForSelector(wc, "#pm-muvekkil-form", 8000);
  }
}

async function saveMuvekkilForm(win: BrowserWindow, renderer: FlowRenderer): Promise<void> {
  const wc = win.webContents;
  if (renderer === "legacy") {
    await doubleSubmit(wc, 'button[form="form-muvekkil"]');
  } else {
    await doubleSubmit(wc, ".pm-mvk-modal-save, button[form='pm-muvekkil-form']");
  }
  await sleep(800);
  await waitToast(wc, renderer);
}

async function createGercekMuvekkil(win: BrowserWindow, renderer: FlowRenderer, inputChecks: string[]): Promise<void> {
  await openMuvekkilCreate(win, renderer);
  const wc = win.webContents;
  if (renderer === "legacy") {
    await setSelect(wc, "mvk-tur", "GERCEK_KISI");
    await exerciseInput(wc, "mvk-ad", PARITY.gercekAd);
    await exerciseInput(wc, "mvk-tel", PARITY.gercekTel);
  } else {
    await clickByText(wc, /Gerçek kişi/);
    await exerciseInput(wc, "pm-muvekkil-form-ad", PARITY.gercekAd);
    await exerciseInput(wc, "pm-muvekkil-form-tel", PARITY.gercekTel);
  }
  await closeModal(wc);
  await openMuvekkilCreate(win, renderer);
  if (renderer === "legacy") {
    await setSelect(wc, "mvk-tur", "GERCEK_KISI");
    await setInput(wc, "mvk-ad", PARITY.gercekAd);
    await setInput(wc, "mvk-tel", PARITY.gercekTel);
  } else {
    await clickByText(wc, /Gerçek kişi/);
    await setInput(wc, "pm-muvekkil-form-ad", PARITY.gercekAd);
    await setInput(wc, "pm-muvekkil-form-tel", PARITY.gercekTel);
  }
  await saveMuvekkilForm(win, renderer);
  inputChecks.push("muvekkil-gercek");
  pass("2. Gerçek kişi müvekkil oluştur");

  // düzenle
  await clickRowLink(wc, PARITY.gercekAd);
  await sleep(600);
  await clickByText(wc, /^Düzenle$/);
  await waitForSelector(wc, renderer === "legacy" ? "#form-muvekkil" : "#pm-muvekkil-form", 8000);
  if (renderer === "legacy") {
    await exerciseInput(wc, "mvk-ad", PARITY.gercekAdRev);
    await exerciseInput(wc, "mvk-tel", PARITY.gercekTelRev);
    await saveMuvekkilForm(win, renderer);
  } else {
    await exerciseInput(wc, "pm-muvekkil-form-ad", PARITY.gercekAdRev);
    await exerciseInput(wc, "pm-muvekkil-form-tel", PARITY.gercekTelRev);
    await saveMuvekkilForm(win, renderer);
  }
  pass("2b. Gerçek kişi düzenle");
}

async function createTuzelMuvekkil(win: BrowserWindow, renderer: FlowRenderer, inputChecks: string[]): Promise<void> {
  if (renderer === "legacy") {
    await clickLegacyNav(win.webContents, "#/");
    await waitHome(win.webContents, renderer);
  } else {
    await clickSidebar(win.webContents, "Müvekkiller");
  }
  await openMuvekkilCreate(win, renderer);
  const wc = win.webContents;
  if (renderer === "legacy") {
    await setSelect(wc, "mvk-tur", "TUZEL_KISI");
    await exerciseInput(wc, "mvk-unvan", PARITY.tuzelUnvan);
    await exerciseInput(wc, "mvk-yetkili-tel", PARITY.tuzelYetkiliTel);
  } else {
    await clickByText(wc, /Tüzel kişi/);
    await exerciseInput(wc, "pm-muvekkil-form-unvan", PARITY.tuzelUnvan);
    await exerciseInput(wc, "pm-muvekkil-form-yetkili-tel", PARITY.tuzelYetkiliTel);
  }
  await saveMuvekkilForm(win, renderer);
  inputChecks.push("muvekkil-tuzel");
  pass("3. Tüzel kişi müvekkil");
}

async function createAndEditDosya(win: BrowserWindow, renderer: FlowRenderer, inputChecks: string[]): Promise<void> {
  const wc = win.webContents;
  await clickRowLink(wc, PARITY.gercekAdRev);
  await sleep(700);
  await clickByText(wc, /Yeni dosya/i);
  await waitForSelector(wc, renderer === "legacy" ? "#form-dosya" : "#pm-dosya-form", 8000);
  if (renderer === "legacy") {
    await exerciseInput(wc, "dosya-konu", PARITY.dosyaKonu);
    await setInput(wc, "dosya-mahkeme", PARITY.dosyaMahkeme);
    await setInput(wc, "dosya-no", PARITY.dosyaNo);
    await doubleSubmit(wc, 'button[form="form-dosya"]');
  } else {
    await exerciseInput(wc, "pm-dosya-form-konu", PARITY.dosyaKonu);
    await setInput(wc, "pm-dosya-form-mahkeme", PARITY.dosyaMahkeme);
    await setInput(wc, "pm-dosya-form-no", PARITY.dosyaNo);
    await doubleSubmit(wc, "button[form='pm-dosya-form']");
  }
  await sleep(900);
  await waitToast(wc, renderer);
  inputChecks.push("dosya-create");
  pass("4. Dosya oluştur");

  await clickRowLink(wc, PARITY.dosyaKonu);
  await sleep(1000);
  const onDosya =
    renderer === "legacy"
      ? await waitForSelector(wc, ".desk-page--dosya-detail", 15000)
      : await waitForSelector(wc, ".pm-dosya-page", 15000);
  assert(onDosya, "Dosya detay açılmadı");
  pass("5. Dosya detay (satır tıklama)");

  await clickByText(wc, /Dosyayı düzenle|Dosya düzenle|Düzenle dosya/i);
  await sleep(400);
  if (renderer === "legacy") {
    await setInput(wc, "dosya-konu", PARITY.dosyaKonuRev);
    await setInput(wc, "dosya-mahkeme", PARITY.dosyaMahkemeRev);
    await setInput(wc, "dosya-no", PARITY.dosyaNoRev);
    await doubleSubmit(wc, 'button[form="form-dosya"]');
  } else {
    await setInput(wc, "pm-dosya-form-konu", PARITY.dosyaKonuRev);
    await setInput(wc, "pm-dosya-form-mahkeme", PARITY.dosyaMahkemeRev);
    await setInput(wc, "pm-dosya-form-no", PARITY.dosyaNoRev);
    await doubleSubmit(wc, "button[form='pm-dosya-form']");
  }
  await sleep(800);
  pass("4b. Dosya düzenle");
}

function legacyVisibleButtonsScript(rootExpr: string): string {
  return `Array.from((${rootExpr}).querySelectorAll('button'))
    .filter((b) => {
      const r = b.getBoundingClientRect();
      const st = window.getComputedStyle(b);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    })
    .map((b) => (b.textContent || '').trim())
    .filter(Boolean)`;
}

async function waitLegacySelectorGone(wc: BrowserWindow["webContents"], selector: string, timeoutMs = 12_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const gone = await js<boolean>(wc, `!document.querySelector(${JSON.stringify(selector)})`);
    if (gone) return;
    await sleep(150);
  }
  assert(false, `Modal kapanmadı: ${selector}`);
}

async function logLegacyIslemEkleFailure(wc: BrowserWindow["webContents"]): Promise<void> {
  const diag = await js<{
    hash: string;
    buttons: string[];
    modalClasses: string[];
    toast: string;
  }>(
    wc,
    `(() => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      return {
        hash: location.hash,
        buttons: ${legacyVisibleButtonsScript("document")},
        modalClasses: Array.from(document.querySelectorAll('.modal, .modal-desk, [role="dialog"]'))
          .filter(visible)
          .map((el) => String(el.className || el.getAttribute('role') || el.tagName)),
        toast: (document.querySelector('[class*="toast"], .desk-flash, .form-error')?.textContent || '').trim(),
      };
    })()`,
  );
  console.log("[PARITY] İşlem ekle açılamadı — görünür butonlar:", diag.buttons.join(" | "));
  console.log("[PARITY] Açık modal class:", diag.modalClasses.join(" | ") || "(yok)");
  console.log("[PARITY] Son URL/hash:", diag.hash);
  console.log("[PARITY] Son toast:", diag.toast || "(yok)");
}

async function openLegacyMasrafFromIslemEkle(wc: BrowserWindow["webContents"]): Promise<string[]> {
  await waitLegacySelectorGone(wc, "#form-avans");
  await waitLegacySelectorGone(wc, "#avans-tutar");
  await sleep(300);

  const islemEkleClicked = await js<boolean>(
    wc,
    `(() => {
      const btn = document.querySelector('.desk-page--dosya-detail .desk-toolbar-actions > button.btn-primary.btn-sm');
      if (!btn) return false;
      if (!(btn.textContent || '').trim().includes('İşlem ekle')) return false;
      btn.click();
      return true;
    })()`,
  );
  assert(islemEkleClicked, "Dosya detay İşlem ekle butonu bulunamadı (.desk-toolbar-actions > button.btn-primary)");

  const menuVisible = await waitForSelector(wc, ".desk-islem-secim", 8000);
  if (!menuVisible) {
    await logLegacyIslemEkleFailure(wc);
    assert(false, "İşlem ekle seçim modalı açılmadı");
  }

  const buttonTexts = await js<string[]>(
    wc,
    `(() => {
      const root = document.querySelector('.desk-islem-secim');
      if (!root) return [];
      return ${legacyVisibleButtonsScript("root")};
    })()`,
  );
  console.log("[PARITY] İşlem ekle menü butonları:", buttonTexts.join(" | "));

  const masrafClicked = await js<boolean>(
    wc,
    `(() => {
      const root = document.querySelector('.desk-islem-secim');
      if (!root) return false;
      const btn = Array.from(root.querySelectorAll('button')).find((b) => {
        if ((b.textContent || '').trim() !== 'Masraf girişi') return false;
        const r = b.getBoundingClientRect();
        const st = window.getComputedStyle(b);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      });
      if (!btn) return false;
      btn.click();
      return true;
    })()`,
  );
  assert(masrafClicked, 'İşlem ekle menüsünde "Masraf girişi" butonu tıklanamadı');

  const masrafFormOk = await waitForSelector(wc, "#masraf-tutar", 8000);
  assert(masrafFormOk, "Masraf formu açılmadı (#masraf-tutar)");
  return buttonTexts;
}

function legacyFindVisibleKasaRowExpr(aciklama: string): string {
  return `(function() {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const st = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    return (
      Array.from(document.querySelectorAll('tr')).find(
        (tr) => visible(tr) && (tr.textContent || '').includes(${JSON.stringify(aciklama)}),
      ) || null
    );
  })()`;
}

async function legacyKasaRowExists(wc: BrowserWindow["webContents"], aciklama: string): Promise<boolean> {
  return js<boolean>(wc, `!!${legacyFindVisibleKasaRowExpr(aciklama)}`);
}

async function clickLegacyKasaRowButton(
  wc: BrowserWindow["webContents"],
  aciklama: string,
  buttonTitle: string,
): Promise<boolean> {
  return js<boolean>(
    wc,
    `(() => {
      const row = ${legacyFindVisibleKasaRowExpr(aciklama)};
      if (!row) return false;
      const btn = Array.from(row.querySelectorAll('button')).find(
        (b) => b.title === ${JSON.stringify(buttonTitle)},
      );
      if (!btn) return false;
      btn.click();
      return true;
    })()`,
  );
}

async function openLegacyKasaDuzeltmeModal(wc: BrowserWindow["webContents"], rowAciklama: string): Promise<void> {
  const rowFound = await legacyKasaRowExists(wc, rowAciklama);
  assert(rowFound, `Kasa satırı bulunamadı: ${rowAciklama}`);

  const needsOnay = await js<boolean>(
    wc,
    `(() => {
      const row = ${legacyFindVisibleKasaRowExpr(rowAciklama)};
      if (!row) return false;
      return !!Array.from(row.querySelectorAll('button')).find((b) => b.title === 'Onayla');
    })()`,
  );
  if (needsOnay) {
    const onaylaClicked = await clickLegacyKasaRowButton(wc, rowAciklama, "Onayla");
    assert(onaylaClicked, "Masraf satırında Onayla butonu tıklanamadı");
    await clickConfirmIfOpen(wc);
    await sleep(800);
    console.log("[PARITY] Masraf satırı onaylandı");
  }

  const duzeltmeClicked = await clickLegacyKasaRowButton(wc, rowAciklama, "Düzeltme ekle");
  assert(duzeltmeClicked, 'Onaylı masraf satırında "Düzeltme ekle" butonu tıklanamadı');

  const modalOk = await waitForSelector(wc, "#form-duzeltme", 8000);
  assert(modalOk, "Düzeltme modalı açılmadı (#form-duzeltme)");

  const inputs = await js<string[]>(
    wc,
    `(() => {
      const form = document.querySelector('#form-duzeltme');
      if (!form) return [];
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      return Array.from(form.querySelectorAll('input, textarea, select'))
        .filter(visible)
        .map((el) => {
          const id = el.id ? '#' + el.id : '';
          const name = el.getAttribute('name') || '';
          return (id || name || el.tagName) + ':' + el.tagName.toLowerCase() + (el.type ? '[' + el.type + ']' : '');
        });
    })()`,
  );
  console.log("[PARITY] Düzeltme modal inputları:", inputs.join(" | "));
}

async function addAvansMasrafDuzeltme(win: BrowserWindow, renderer: FlowRenderer, inputChecks: string[]): Promise<void> {
  const wc = win.webContents;
  await clickByText(wc, /İşlem ekle/i);
  await sleep(400);
  await clickByText(wc, /^Avans/i);
  await waitForSelector(wc, renderer === "legacy" ? "#avans-tutar" : "#pm-avans-tutar", 8000);
  if (renderer === "legacy") {
    await exerciseInput(wc, "avans-tutar", PARITY.avansTutar);
    await setInput(wc, "avans-aciklama", PARITY.avansAciklama);
    await doubleSubmit(wc, 'button[form="form-avans"]');
  } else {
    await exerciseInput(wc, "pm-avans-tutar", PARITY.avansTutar);
    await setInput(wc, "pm-avans-aciklama", PARITY.avansAciklama);
    await doubleSubmit(wc, "button[form='pm-form-avans']");
  }
  await sleep(900);
  inputChecks.push("avans");
  pass("6. Avans");

  if (renderer === "legacy") {
    await openLegacyMasrafFromIslemEkle(wc);
  } else {
    await clickByText(wc, /İşlem ekle/i);
    await sleep(400);
    await clickByText(wc, /^Masraf/i);
    const masrafFormOk = await waitForSelector(wc, "#pm-masraf-tutar", 8000);
    assert(masrafFormOk, "Masraf formu açılmadı");
  }
  if (renderer === "legacy") {
    await exerciseInput(wc, "masraf-tutar", PARITY.masrafTutar);
    await setInput(wc, "masraf-aciklama", PARITY.masrafAciklama);
    await doubleSubmit(wc, 'button[form="form-masraf"]');
  } else {
    await exerciseInput(wc, "pm-masraf-tutar", PARITY.masrafTutar);
    await setInput(wc, "pm-masraf-aciklama", PARITY.masrafAciklama);
    await doubleSubmit(wc, "button[form='pm-form-masraf']");
  }
  await sleep(900);
  pass("7. Masraf ekle");

  // masraf düzenle — ilk masraf satırı
  if (renderer === "legacy") {
    const duzenleClicked = await clickLegacyKasaRowButton(wc, PARITY.masrafAciklama, "Düzenle");
    assert(duzenleClicked, `Masraf satırında Düzenle bulunamadı: ${PARITY.masrafAciklama}`);
  } else {
    await js(
      wc,
      `(() => {
        const row = Array.from(document.querySelectorAll('tr')).find(tr => (tr.textContent||'').includes(${JSON.stringify(PARITY.masrafAciklama)}));
        const btn = row && Array.from(row.querySelectorAll('button')).find(b => b.title === 'Düzenle' || (b.textContent||'').includes('Düzenle'));
        btn?.click();
      })()`,
    );
  }
  await sleep(500);
  if (renderer === "legacy") {
    await exerciseInput(wc, "masraf-tutar", PARITY.masrafTutarRev);
    await doubleSubmit(wc, 'button[form="form-masraf"]');
  } else {
    await exerciseInput(wc, "pm-masraf-tutar", PARITY.masrafTutarRev);
    await doubleSubmit(wc, "button[form='pm-form-masraf']");
  }
  await sleep(800);
  inputChecks.push("masraf-edit");
  pass("7b. Masraf düzenle");

  if (renderer === "legacy") {
    await openLegacyKasaDuzeltmeModal(wc, PARITY.masrafAciklama);
    await exerciseInput(wc, "dz-tutar", PARITY.duzeltmeTutar);
    await setInput(wc, "dz-aciklama", PARITY.duzeltmeAciklama);
    await doubleSubmit(wc, 'button[form="form-duzeltme"]');
  } else {
    await js(
      wc,
      `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.title === 'Düzeltme ekle');
        btn?.click();
      })()`,
    );
    await sleep(500);
    await exerciseInput(wc, "pm-dz-tutar", PARITY.duzeltmeTutar);
    await setInput(wc, "pm-dz-aciklama", PARITY.duzeltmeAciklama);
    await doubleSubmit(wc, "button[form='pm-form-duzeltme']");
  }
  await sleep(900);
  pass("8. Kasa düzeltmesi ekle");

  await js(
    wc,
    `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.title === 'Onayla');
      btn?.click();
    })()`,
  );
  await clickConfirmIfOpen(wc);
  await sleep(700);
  pass("8b. Düzeltme onayla");
}

async function vekaletFlow(win: BrowserWindow, renderer: FlowRenderer, inputChecks: string[]): Promise<void> {
  const wc = win.webContents;
  await clickByText(wc, /Vekalet/i);
  await sleep(500);
  await clickByText(wc, /Vekalet ücreti|Anlaşılan|Ücret tanımla/i);
  await waitForSelector(wc, renderer === "legacy" ? "#vu-tutar" : "#pm-vu-tutar", 10000);
  if (renderer === "legacy") {
    await exerciseInput(wc, "vu-tutar", PARITY.vekaletTutar);
    await doubleSubmit(wc, 'button[form="form-vekalet-ucret"]');
  } else {
    await exerciseInput(wc, "pm-vu-tutar", PARITY.vekaletTutar);
    await doubleSubmit(wc, "button[form='pm-form-vekalet-ucret']");
  }
  await sleep(900);
  pass("9. Vekalet ücreti");

  await clickByText(wc, /Tek taksit/i);
  await waitForSelector(wc, renderer === "legacy" ? "#te-tutar" : "#pm-te-tutar", 8000);
  if (renderer === "legacy") {
    await exerciseInput(wc, "te-tutar", PARITY.tekTaksitTutar);
    await setInput(wc, "te-vade", PARITY.vade);
    await doubleSubmit(wc, 'button[form="form-tek-taksit"]');
  } else {
    await exerciseInput(wc, "pm-te-tutar", PARITY.tekTaksitTutar);
    await setInput(wc, "pm-te-vade", PARITY.vade);
    await doubleSubmit(wc, "button[form='pm-form-taksit-ekle']");
  }
  await sleep(900);
  pass("10. Tek taksit");

  await clickByText(wc, /Taksit planı|Plan oluştur|Eşit taksit/i);
  await sleep(500);
  if (renderer === "legacy") {
    await setInput(wc, "tp-tutar", PARITY.planTaksitTutar);
    await setInput(wc, "tp-adet", PARITY.planAdet);
    await setInput(wc, "tp-baslangic", PARITY.planBaslangic);
    await doubleSubmit(wc, 'button[form="form-taksit-plani"]');
  } else {
    await setInput(wc, "pm-tp-tutar", PARITY.planTaksitTutar);
    await setInput(wc, "pm-tp-adet", PARITY.planAdet);
    await setInput(wc, "pm-tp-baslangic", PARITY.planBaslangic);
    await doubleSubmit(wc, "button[form='pm-form-taksit-plani']");
  }
  await sleep(1000);
  pass("11. Eşit taksit planı");

  // ödeme al — tek taksit satırı
  await js(
    wc,
    `(() => {
      const row = Array.from(document.querySelectorAll('tr')).find(tr => /Taksit\\s*#?\\s*1/i.test(tr.textContent||''));
      const btn = row && Array.from(row.querySelectorAll('button')).find(b => /Ödeme|Tahsilat/i.test(b.textContent||'') || b.title === 'Ödeme al');
      btn?.click();
    })()`,
  );
  await sleep(500);
  if (renderer === "legacy") {
    await exerciseInput(wc, "oa-tutar", PARITY.odemeKismi);
    await doubleSubmit(wc, 'button[form="form-odeme-al"]');
  } else {
    await exerciseInput(wc, "pm-oa-tutar", PARITY.odemeKismi);
    await doubleSubmit(wc, "button[form='pm-form-odeme-al']");
  }
  await sleep(900);
  pass("12a. Kısmi ödeme");

  await js(
    wc,
    `(() => {
      const row = Array.from(document.querySelectorAll('tr')).find(tr => /Taksit\\s*#?\\s*1/i.test(tr.textContent||''));
      const btn = row && Array.from(row.querySelectorAll('button')).find(b => /Ödeme|Tahsilat/i.test(b.textContent||'') || b.title === 'Ödeme al');
      btn?.click();
    })()`,
  );
  await sleep(500);
  if (renderer === "legacy") {
    await exerciseInput(wc, "oa-tutar", PARITY.odemeTam);
    await doubleSubmit(wc, 'button[form="form-odeme-al"]');
  } else {
    await exerciseInput(wc, "pm-oa-tutar", PARITY.odemeTam);
    await doubleSubmit(wc, "button[form='pm-form-odeme-al']");
  }
  await sleep(900);
  inputChecks.push("vekalet-odeme");
  pass("12b. Tam ödeme");

  // SMM
  await js(
    wc,
    `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.title === 'SMM Kesildi' || /^SMM$/i.test((b.textContent||'').trim()));
      btn?.click();
    })()`,
  );
  await sleep(700);
  pass("13. SMM");
}

async function ofisKasaFlow(win: BrowserWindow, renderer: FlowRenderer, inputChecks: string[]): Promise<void> {
  const wc = win.webContents;
  if (renderer === "legacy") {
    await clickLegacyNav(wc, "#/ofis-kasasi");
  } else {
    await clickSidebar(wc, "Ofis Kasası");
  }
  await sleep(800);
  await clickByText(wc, /Yeni hareket/i);
  await sleep(500);
  if (renderer === "legacy") {
    await setSelect(wc, "ofk-ftip", "GELIR");
    await exerciseInput(wc, "ofk-ftut", PARITY.ofisGelir);
    await setInput(wc, "ofk-fac", PARITY.ofisGelirAciklama);
    await doubleSubmit(wc, ".modal button.btn-primary");
  } else {
    await setSelect(wc, "pm-ofk-ftip", "GELIR");
    await exerciseInput(wc, "pm-ofk-ftut", PARITY.ofisGelir);
    await setInput(wc, "pm-ofk-fac", PARITY.ofisGelirAciklama);
    await doubleSubmit(wc, ".pm-modal button.pm-btn--primary");
  }
  await sleep(900);
  pass("14a. Ofis gelir");

  await clickByText(wc, /Yeni hareket/i);
  if (renderer === "legacy") {
    await setSelect(wc, "ofk-ftip", "GIDER");
    await exerciseInput(wc, "ofk-ftut", PARITY.ofisGider);
    await setInput(wc, "ofk-fac", PARITY.ofisGiderAciklama);
    await doubleSubmit(wc, ".modal button.btn-primary");
  } else {
    await setSelect(wc, "pm-ofk-ftip", "GIDER");
    await exerciseInput(wc, "pm-ofk-ftut", PARITY.ofisGider);
    await setInput(wc, "pm-ofk-fac", PARITY.ofisGiderAciklama);
    await doubleSubmit(wc, ".pm-modal button.pm-btn--primary");
  }
  await sleep(900);
  pass("14b. Ofis gider");

  await js(
    wc,
    `(() => {
      const row = Array.from(document.querySelectorAll('tr')).find(tr => (tr.textContent||'').includes(${JSON.stringify(PARITY.ofisGelirAciklama)}));
      const btn = row && Array.from(row.querySelectorAll('button')).find(b => b.title === 'Düzeltme ekle');
      btn?.click();
    })()`,
  );
  await sleep(500);
  if (renderer === "legacy") {
    await js(
      wc,
      `(() => {
        ${PARITY_SET_VALUE_SNIPPET}
        const modal = document.querySelector('.modal-desk--wide');
        const money = modal?.querySelector('input.desk-num, input[type="text"]');
        __mkdSetValue(money, '950,00');
        const note = modal?.querySelector('textarea');
        __mkdSetValue(note, ${JSON.stringify(PARITY.ofisDuzeltmeAciklama)});
      })()`,
    );
    await doubleSubmit(wc, ".modal-desk--wide .btn-primary");
  } else {
    await exerciseInput(wc, "pm-ofk-dtutar", "950,00");
    await setInput(wc, "pm-ofk-dnot", PARITY.ofisDuzeltmeAciklama);
    await doubleSubmit(wc, ".pm-modal button.pm-btn--primary");
  }
  await sleep(900);
  inputChecks.push("ofis-kasа");
  pass("15. Ofis düzeltme");
}

async function icraFlow(win: BrowserWindow, renderer: FlowRenderer): Promise<void> {
  const wc = win.webContents;
  if (renderer === "legacy") {
    await clickLegacyNav(wc, "#/icra-tahsilat");
  } else {
    await clickSidebar(wc, "İcra Tahsilat");
  }
  await sleep(800);
  await clickByText(wc, /Yeni.*[Aa]lacak|Alacak ekle/i);
  await sleep(500);
  if (renderer === "legacy") {
    await setSelect(wc, "icra-alacak-tur", "KARSI_TARAF_VEKALET");
    await setInput(wc, "icra-alacak-borclu", PARITY.icraBorclu);
    await setSelect(wc, "icra-alacak-muvekkil", "1");
    await setSelect(wc, "icra-alacak-dosya", "1");
    await exerciseInput(wc, "icra-alacak-toplam", PARITY.icraToplam);
    await setInput(wc, "icra-alacak-adet", PARITY.icraAdet);
    await setInput(wc, "icra-alacak-vade", PARITY.vade);
    await doubleSubmit(wc, 'button[form="form-icra-alacak"]');
  } else {
    await setSelect(wc, "pm-icra-alacak-tur", "KARSI_TARAF_VEKALET");
    await setInput(wc, "pm-icra-alacak-borclu", PARITY.icraBorclu);
    await setSelect(wc, "pm-icra-alacak-muvekkil", "1");
    await setSelect(wc, "pm-icra-alacak-dosya", "1");
    await exerciseInput(wc, "pm-icra-alacak-toplam", PARITY.icraToplam);
    await setInput(wc, "pm-icra-alacak-adet", PARITY.icraAdet);
    await setInput(wc, "pm-icra-alacak-vade", PARITY.vade);
    await doubleSubmit(wc, ".pm-modal button.pm-btn--primary");
  }
  await sleep(1200);
  pass("16. İcra alacağı");

  await js(
    wc,
    `(() => {
      const row = Array.from(document.querySelectorAll('tr')).find(tr => (tr.textContent||'').includes(${JSON.stringify(PARITY.icraBorclu)}));
      const btn = row && Array.from(row.querySelectorAll('button, a')).find(b => /Detay|Görüntüle/i.test(b.textContent||'') || b.title === 'Detay');
      btn?.click();
    })()`,
  );
  await sleep(700);
  await js(
    wc,
    `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /Ödeme al|Taksit ödemesi/i.test(b.textContent||''));
      btn?.click();
    })()`,
  );
  await sleep(500);
  if (renderer === "legacy") {
    await js(
      wc,
      `(() => {
        ${PARITY_SET_VALUE_SNIPPET}
        const money = document.querySelector('.desk-icra-submodal-body input[type="text"], .desk-icra-submodal-body input.desk-num');
        __mkdSetValue(money, ${JSON.stringify(PARITY.icraOdeme)});
      })()`,
    );
  } else {
    await exerciseInput(wc, "pm-icra-odeme-tutar", PARITY.icraOdeme);
  }
  await clickByText(wc, /Ödemeyi Kaydet|Kaydet/i);
  await sleep(900);
  pass("17. İcra kısmi ödeme");
}

async function settingsAndPeriod(win: BrowserWindow, renderer: FlowRenderer): Promise<void> {
  const wc = win.webContents;
  if (renderer === "legacy") {
    await clickLegacyNav(wc, "#/ayarlar/ofis");
    await sleep(700);
    await exerciseInput(wc, "ofis-adi", PARITY.ofisAd);
    await setInput(wc, "ofis-adres", PARITY.ofisAdres);
    await clickByText(wc, /^Kaydet$/);
    await sleep(800);
    await js(wc, `document.querySelector('input[name="hesap-donemi-mode"][value], input[name="hesap-donemi-mode"]')`);
    await js(
      wc,
      `(() => {
        const radios = Array.from(document.querySelectorAll('input[name="hesap-donemi-mode"]'));
        const yearly = radios.find(r => r.closest('label')?.textContent?.includes('Yıllık'));
        yearly?.click();
      })()`,
    );
    await clickByText(wc, /Dönem ayarını kaydet|Kaydet/i);
  } else {
    await clickSidebar(wc, "Ayarlar");
    await sleep(700);
    await exerciseInput(wc, "pm-ofis-adi", PARITY.ofisAd);
    await setInput(wc, "pm-ofis-adres", PARITY.ofisAdres);
    await clickByText(wc, /^Kaydet$/);
    await sleep(800);
    await clickByText(wc, /Yıllık dönem/);
    await clickByText(wc, /Dönem ayarını kaydet|Kaydet/i);
  }
  await sleep(800);
  pass("18-19. Ofis bilgileri + hesap dönemi");
}

async function openReports(win: BrowserWindow, renderer: FlowRenderer): Promise<string[]> {
  const wc = win.webContents;
  const reportTexts: string[] = [];

  if (renderer === "legacy") {
    await clickLegacyNav(wc, "#/");
    await waitHome(wc, renderer);
    await clickRowLink(wc, PARITY.gercekAdRev);
    await clickRowLink(wc, PARITY.dosyaKonuRev);
    await sleep(800);
    await clickByText(wc, /Hesap Özeti Yazdır/i);
    await sleep(1200);
    reportTexts.push(await js<string>(wc, `document.body.innerText.slice(0, 4000)`));
    await js(wc, `history.back()`);
    await sleep(600);
    await clickLegacyNav(wc, "#/ofis-kasasi");
    await sleep(600);
    await clickByText(wc, /Rapor|Yazdır/i);
    await sleep(1200);
    reportTexts.push(await js<string>(wc, `document.body.innerText.slice(0, 4000)`));
    await clickLegacyNav(wc, "#/icra-tahsilat");
    await sleep(600);
    await clickByText(wc, /Rapor/i);
    await sleep(1200);
    reportTexts.push(await js<string>(wc, `document.body.innerText.slice(0, 4000)`));
  } else {
    await clickSidebar(wc, "Müvekkiller");
    await clickRowLink(wc, PARITY.gercekAdRev);
    await clickRowLink(wc, PARITY.dosyaKonuRev);
    await sleep(800);
    await clickByText(wc, /Hesap özeti|Hesap Özeti/i);
    await sleep(1200);
    reportTexts.push(await js<string>(wc, `document.body.innerText.slice(0, 4000)`));
    await clickSidebar(wc, "Raporlar");
    await sleep(800);
    await clickByText(wc, /Ofis [Kk]asa/i);
    await sleep(1200);
    reportTexts.push(await js<string>(wc, `document.body.innerText.slice(0, 4000)`));
    await clickByText(wc, /İcra/i);
    await sleep(1200);
    reportTexts.push(await js<string>(wc, `document.body.innerText.slice(0, 4000)`));
  }
  pass("20. Raporlar açıldı");
  return reportTexts;
}

async function captureVisible(win: BrowserWindow, renderer: FlowRenderer, reports: string[]): Promise<VisibleSnapshot> {
  const wc = win.webContents;
  if (renderer === "legacy") {
    await clickLegacyNav(wc, "#/");
  } else {
    await clickSidebar(wc, "Genel Bakış");
  }
  await sleep(800);
  const kpi = await js<string[]>(
    wc,
    `Array.from(document.querySelectorAll('.desk-home-kpi-value, .pm-kpi-value, .pm-finance-card__value')).map(el => (el.textContent||'').trim()).filter(Boolean)`,
  );
  return { kpi, reportsDigest: reports.map((r) => r.replace(/\s+/g, " ").slice(0, 500)) };
}

export async function runLegacyParityFlow(win: BrowserWindow): Promise<FlowResult> {
  const consoleBag = attachFlowConsole(win);
  const inputChecks: string[] = [];
  await win.loadURL("about:blank");
  await installDialogAutoAccept(win.webContents);

  await runStep(win, "1. Giriş", () => loginLegacy(win), consoleBag);
  if (process.env.MKD_PARITY_LEGACY_STARTUP_PROBE === "1") {
    console.log("[BOOT] startup probe — parity akışı durduruldu");
    return { renderer: "legacy", console: consoleBag, inputChecks, visible: {} };
  }
  await runStep(win, "2-3. Müvekkil oluştur", async () => {
    await createGercekMuvekkil(win, "legacy", inputChecks);
    await createTuzelMuvekkil(win, "legacy", inputChecks);
  }, consoleBag);
  await runStep(win, "4-5. Dosya oluştur ve detay", () => createAndEditDosya(win, "legacy", inputChecks), consoleBag);
  await runStep(win, "6-8. Avans/masraf/düzeltme", () => addAvansMasrafDuzeltme(win, "legacy", inputChecks), consoleBag);
  await runStep(win, "9-13. Vekalet/taksit/ödeme/SMM", () => vekaletFlow(win, "legacy", inputChecks), consoleBag);
  await runStep(win, "14-15. Ofis kasası", () => ofisKasaFlow(win, "legacy", inputChecks), consoleBag);
  await runStep(win, "16-17. İcra tahsilat", () => icraFlow(win, "legacy"), consoleBag);
  await runStep(win, "18-19. Ayarlar ve hesap dönemi", () => settingsAndPeriod(win, "legacy"), consoleBag);
  let reportTexts: string[] = [];
  await runStep(
    win,
    "20. Raporlar",
    async () => {
      reportTexts = await openReports(win, "legacy");
    },
    consoleBag,
  );
  const visible = await captureVisible(win, "legacy", reportTexts);

  mkdirSync(PARITY_OUT, { recursive: true });
  writeFileSync(join(PARITY_OUT, "legacy-visible.json"), JSON.stringify(visible, null, 2), "utf8");
  writeFileSync(join(PARITY_OUT, "legacy-console.json"), JSON.stringify(consoleBag, null, 2), "utf8");

  return { renderer: "legacy", console: consoleBag, inputChecks, visible };
}

export async function runParityFlow(win: BrowserWindow, renderer: FlowRenderer): Promise<FlowResult> {
  if (renderer === "legacy") {
    return runLegacyParityFlow(win);
  }
  const consoleBag = attachFlowConsole(win);
  const inputChecks: string[] = [];
  await installDialogAutoAccept(win.webContents);

  await login(win, renderer);
  await createGercekMuvekkil(win, renderer, inputChecks);
  await createTuzelMuvekkil(win, renderer, inputChecks);
  await createAndEditDosya(win, renderer, inputChecks);
  await addAvansMasrafDuzeltme(win, renderer, inputChecks);
  await vekaletFlow(win, renderer, inputChecks);
  await ofisKasaFlow(win, renderer, inputChecks);
  await icraFlow(win, renderer);
  await settingsAndPeriod(win, renderer);
  const reports = await openReports(win, renderer);
  const visible = await captureVisible(win, renderer, reports);

  const fatal = consoleBag.errors.filter(
    (e) => !/devtools|Autofill|Third-party cookie|Ad soyad zorunludur/i.test(e),
  );
  if (fatal.length) {
    console.warn(`[WARN] ${renderer} console:`, fatal.slice(0, 8));
  }

  mkdirSync(PARITY_OUT, { recursive: true });
  writeFileSync(join(PARITY_OUT, `${renderer}-visible.json`), JSON.stringify(visible, null, 2), "utf8");
  writeFileSync(join(PARITY_OUT, `${renderer}-console.json`), JSON.stringify(consoleBag, null, 2), "utf8");

  return { renderer, console: consoleBag, inputChecks, visible };
}
