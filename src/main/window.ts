import { BrowserWindow, shell, app } from "electron";
import { join } from "node:path";
import { getAppIconPath } from "./appIcon";
import { registerEditableContextMenu } from "./contextMenu";

export function createMainWindow(): BrowserWindow {
  const iconPath = getAppIconPath();
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: "Woontegra Müvekkil Kasa Defteri",
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.maximize();

  registerEditableContextMenu(win);

  win.on("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    const legacy = process.env.MKD_RENDERER === "legacy";
    const html = legacy
      ? join(__dirname, "../renderer/index.html")
      : join(__dirname, "../renderer-premium/index.html");
    win.loadFile(html);
  }

  return win;
}
