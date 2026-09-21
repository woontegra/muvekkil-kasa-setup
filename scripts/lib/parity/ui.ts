import type { BrowserWindow, WebContents } from "electron";
import { SET_INPUT_VALUE, assert, js, sleep, waitForSelector } from "../premium-e2e-harness";

export const PARITY_SET_VALUE_SNIPPET = `
function __mkdSetValue(el, value) {
  if (!el) throw new Error('element yok');
  el.focus();
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (!setter) throw new Error('value setter yok');
  setter.call(el, value);
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(value) }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
`;

export type FlowRenderer = "legacy" | "premium";

export type ConsoleBag = {
  errors: string[];
  warnings: string[];
  ipc: string[];
};

export function attachFlowConsole(win: BrowserWindow): ConsoleBag {
  const bag: ConsoleBag = { errors: [], warnings: [], ipc: [] };
  win.webContents.on("console-message", (_e, level, message) => {
    const m = String(message);
    if (level >= 2) bag.errors.push(m);
    else if (level === 1) bag.warnings.push(m);
    if (/ipc|sqlite|uncaught|render/i.test(m)) bag.ipc.push(m);
  });
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    bag.errors.push(`did-fail-load ${code} ${desc} ${url}`);
  });
  return bag;
}

export async function installDialogAutoAccept(wc: WebContents): Promise<void> {
  await js(
    wc,
    `(() => {
      window.confirm = () => true;
      window.alert = () => {};
    })()`,
  );
}

export async function clickByText(wc: WebContents, pattern: string | RegExp, root = "document"): Promise<boolean> {
  const re = pattern instanceof RegExp ? pattern.source : pattern;
  const flags = pattern instanceof RegExp ? pattern.flags : "i";
  return js<boolean>(
    wc,
    `(() => {
      const re = new RegExp(${JSON.stringify(re)}, ${JSON.stringify(flags)});
      const nodes = Array.from(${root}.querySelectorAll('button, a, [role="tab"], label, span'));
      const el = nodes.find(n => re.test((n.textContent || '').trim()));
      if (!el) return false;
      el.click();
      return true;
    })()`,
  );
}

export async function clickSidebar(wc: WebContents, label: string): Promise<void> {
  const ok = await js<boolean>(
    wc,
    `(() => {
      const el = Array.from(document.querySelectorAll('.pm-sidebar-item')).find(a => (a.textContent||'').includes(${JSON.stringify(label)}));
      if (!el) return false;
      el.click();
      return true;
    })()`,
  );
  assert(ok, `Premium sidebar tıklanamadı: ${label}`);
}

export async function clickLegacyNav(wc: WebContents, href: string): Promise<void> {
  const ok = await js<boolean>(wc, `(() => { const el = document.querySelector('a[href="${href}"]'); if (!el) return false; el.click(); return true; })()`);
  assert(ok, `Legacy nav tıklanamadı: ${href}`);
}

export async function setInput(wc: WebContents, id: string, value: string): Promise<void> {
  await js(
    wc,
    `(() => {
      ${PARITY_SET_VALUE_SNIPPET}
      const el = document.getElementById(${JSON.stringify(id)});
      __mkdSetValue(el, ${JSON.stringify(value)});
    })()`,
  );
}

export async function setSelect(wc: WebContents, id: string, value: string): Promise<void> {
  await js(
    wc,
    `(() => {
      const el = document.getElementById(${JSON.stringify(id)});
      if (!el) throw new Error('select yok: ${id}');
      el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event('change', { bubbles: true }));
    })()`,
  );
}

export async function exerciseInput(wc: WebContents, id: string, finalValue: string): Promise<void> {
  await js(
    wc,
    `(() => {
      ${SET_INPUT_VALUE}
      const el = document.getElementById(${JSON.stringify(id)});
      if (!el) throw new Error('input yok: ${id}');
      function type(v) { __mkdSetInput(el, v); }
      type('x');
      type('');
      type('temp');
      el.focus();
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
      type('');
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      type(${JSON.stringify(finalValue)});
    })()`,
  );
}

export async function doubleSubmit(wc: WebContents, selector: string): Promise<void> {
  await js(
    wc,
    `(() => {
      const btn = document.querySelector(${JSON.stringify(selector)});
      if (!btn) throw new Error('submit yok');
      btn.click();
      btn.click();
    })()`,
  );
}

export async function waitToast(wc: WebContents, renderer: FlowRenderer, timeoutMs = 8000): Promise<boolean> {
  if (renderer === "premium") {
    return waitForSelector(wc, ".pm-toast, .pm-toast-item", timeoutMs);
  }
  return true;
}

export async function clickConfirmIfOpen(wc: WebContents): Promise<void> {
  await sleep(150);
  await js(
    wc,
    `(() => {
      const dlg = document.querySelector('.modal-desk--confirm, .pm-modal');
      if (!dlg) return;
      const btn = Array.from(dlg.querySelectorAll('button')).find(b => /^Onayla$/i.test((b.textContent||'').trim()));
      btn?.click();
    })()`,
  );
  await sleep(200);
}

export async function closeModal(wc: WebContents): Promise<void> {
  await js(
    wc,
    `(() => {
      const btn = Array.from(document.querySelectorAll('.modal button, .pm-modal button'))
        .find(b => /İptal|Kapat|Vazgeç/i.test(b.textContent||''));
      btn?.click();
    })()`,
  );
  await sleep(250);
}

export async function clickRowLink(wc: WebContents, text: string): Promise<void> {
  const ok = await js<boolean>(
    wc,
    `(() => {
      const row = Array.from(document.querySelectorAll('tr')).find(tr => (tr.textContent||'').includes(${JSON.stringify(text)}));
      const link = row?.querySelector('a, .desk-home-row-btn, .pm-table-link, button');
      if (!link) return false;
      link.click();
      return true;
    })()`,
  );
  assert(ok, `Satır tıklanamadı: ${text}`);
}

export async function waitHome(wc: WebContents, renderer: FlowRenderer): Promise<void> {
  const sel = renderer === "legacy" ? ".desk-home-dashboard" : ".pm-overview, .pm-shell";
  const ok = await waitForSelector(wc, sel, 45000);
  assert(ok, "Ana sayfa yüklenmedi");
}
