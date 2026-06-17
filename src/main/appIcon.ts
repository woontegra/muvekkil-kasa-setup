import { app } from "electron";
import { existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

function getMainDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

/** Dev ve production için Woontegra uygulama ikonu yolu */
export function getAppIconPath(): string | undefined {
  if (app.isPackaged) {
    const bundled = join(process.resourcesPath, "icon.ico");
    if (existsSync(bundled)) return bundled;
  }

  const fromResCwd = join(process.cwd(), "resources", "icon.ico");
  if (existsSync(fromResCwd)) return fromResCwd;

  const mainDir = getMainDir();
  const fromResMain = normalize(join(mainDir, "..", "..", "resources", "icon.ico"));
  if (existsSync(fromResMain)) return fromResMain;

  const fromBuildCwd = join(process.cwd(), "build", "icon.ico");
  if (existsSync(fromBuildCwd)) return fromBuildCwd;

  const fromBuildMain = normalize(join(mainDir, "..", "..", "build", "icon.ico"));
  if (existsSync(fromBuildMain)) return fromBuildMain;

  return undefined;
}
