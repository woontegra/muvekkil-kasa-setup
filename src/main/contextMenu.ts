import { BrowserWindow, Menu, clipboard, type MenuItemConstructorOptions } from "electron";

/** Input / textarea / contenteditable alanlarda sağ tık Kes/Kopyala/Yapıştır/Tümünü seç */
export function registerEditableContextMenu(win: BrowserWindow): void {
  win.webContents.on("context-menu", (_event, params) => {
    const { isEditable, selectionText, editFlags } = params;
    const template: MenuItemConstructorOptions[] = [];

    if (isEditable) {
      const clipboardText = clipboard.readText();
      const canPaste = editFlags.canPaste || clipboardText.length > 0;

      template.push(
        { role: "cut", label: "Kes", enabled: editFlags.canCut },
        { role: "copy", label: "Kopyala", enabled: editFlags.canCopy },
        { role: "paste", label: "Yapıştır", enabled: canPaste },
        { type: "separator" },
        { role: "selectAll", label: "Tümünü seç", enabled: editFlags.canSelectAll }
      );
    } else if (selectionText && selectionText.length > 0) {
      template.push({ role: "copy", label: "Kopyala" });
    }

    if (template.length === 0) return;

    Menu.buildFromTemplate(template).popup({ window: win });
  });
}
