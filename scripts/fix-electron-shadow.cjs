const fs = require("fs");
const path = require("path");

const electronDir = path.join(__dirname, "..", "node_modules", "electron");
const indexPath = path.join(electronDir, "index.js");
const cliPath = path.join(electronDir, "cli.js");
const pkgPath = path.join(electronDir, "package.json");

if (!fs.existsSync(electronDir)) {
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
if (pkg.main) {
  delete pkg.main;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

if (fs.existsSync(indexPath)) {
  fs.unlinkSync(indexPath);
}

const cliSource = `#!/usr/bin/env node
const proc = require('child_process');
const fs = require('fs');
const path = require('path');
const electron = path.join(__dirname, 'dist', fs.readFileSync(path.join(__dirname, 'path.txt'), 'utf8').trim());
const child = proc.spawn(electron, process.argv.slice(2), { stdio: 'inherit', windowsHide: false });
child.on('close', function (code, signal) {
  if (code === null) {
    console.error(electron, 'exited with signal', signal);
    process.exit(1);
  }
  process.exit(code);
});
const handleTerminationSignal = function (signal) {
  process.on(signal, function signalHandler () {
    if (!child.killed) {
      child.kill(signal);
    }
  });
};
handleTerminationSignal('SIGINT');
handleTerminationSignal('SIGTERM');
`;

fs.writeFileSync(cliPath, cliSource);
