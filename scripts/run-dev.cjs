const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.join(__dirname, "..");
const electronDir = path.join(root, "node_modules", "electron");
const pathFile = path.join(electronDir, "path.txt");

if (fs.existsSync(pathFile)) {
  const executablePath = fs.readFileSync(pathFile, "utf8").trim();
  process.env.ELECTRON_EXEC_PATH = path.join(electronDir, "dist", executablePath);
}

const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["electron-vite", "dev"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 1));
