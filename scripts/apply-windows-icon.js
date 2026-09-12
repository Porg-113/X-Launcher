const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

exports.default = async function applyWindowsIcon(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const projectDir = context.packager.projectDir;
  const iconPath = path.join(projectDir, 'icons', 'icon.ico');
  const rceditPath = path.join(projectDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe');
  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);

  if (!fs.existsSync(iconPath)) {
    throw new Error(`Windows icon not found: ${iconPath}`);
  }

  if (!fs.existsSync(rceditPath)) {
    throw new Error(`rcedit.exe not found: ${rceditPath}`);
  }

  if (!fs.existsSync(exePath)) {
    throw new Error(`Packaged app executable not found: ${exePath}`);
  }

  execFileSync(rceditPath, [
    exePath,
    '--set-icon',
    iconPath,
    '--set-version-string',
    'FileDescription',
    context.packager.appInfo.productName,
    '--set-version-string',
    'ProductName',
    context.packager.appInfo.productName,
    '--set-file-version',
    context.packager.appInfo.version,
    '--set-product-version',
    context.packager.appInfo.version
  ], { stdio: 'inherit' });
};
