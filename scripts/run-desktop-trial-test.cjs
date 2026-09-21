const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const electronDir = path.join(root, "node_modules", "electron");
const executablePath = fs.readFileSync(path.join(electronDir, "path.txt"), "utf8").trim();
const electronPath = path.join(electronDir, "dist", executablePath);
const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };

function run(label, args) {
  console.log(`\n--- ${label} ---`);
  const result = spawnSync(electronPath, args, { cwd: root, stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("legacy paid upgrade", [path.join(__dirname, "test-legacy-paid-upgrade.cjs")]);
run("email login / legacy username", [path.join(__dirname, "test-email-login.cjs")]);
run("legacy paid username login", [path.join(__dirname, "test-legacy-paid-login.cjs")]);
process.exit(0);
