'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('application and installer use the X Client brand while preserving upgrade identity', () => {
  const packageJson = JSON.parse(read('package.json'));
  const installerScript = read('scripts/installer.nsh');

  assert.equal(packageJson.name, 'x-client');
  assert.equal(packageJson.version, '1.5.0');
  assert.equal(packageJson.build.productName, 'X Client');
  assert.equal(packageJson.build.artifactName, 'X-Client-${version}-${arch}.${ext}');
  assert.equal(packageJson.build.nsis.shortcutName, 'X Client');
  assert.equal(packageJson.build.nsis.include, 'scripts/installer.nsh');
  assert.equal(packageJson.build.appId, 'com.x.launcher.app', 'the legacy app ID is required for in-place upgrades');
  assert.match(installerScript, /Delete "\$DESKTOP\\X Launcher\.lnk"/u);
  assert.match(installerScript, /Delete "\$SMPROGRAMS\\X Launcher\.lnk"/u);
});

test('launcher UI and website expose only X Client branding', () => {
  const launcherHtml = read('index.html');
  const rendererSource = ['part-01.jsfrag', 'part-02.jsfrag', 'part-03.jsfrag', 'part-04.jsfrag']
    .map((fileName) => read(path.join('app.parts', fileName)))
    .join('\n');
  const websiteHtml = read(path.join('docs', 'index.html'));
  const featuresHtml = read(path.join('docs', 'features.html'));
  const downloadsHtml = read(path.join('docs', 'downloads.html'));
  const websiteCss = read(path.join('docs', 'styles.css'));

  assert.match(launcherHtml, /<title>X Client<\/title>/u);
  assert.doesNotMatch(launcherHtml, /X Launcher/u);
  assert.doesNotMatch(rendererSource, /X Launcher/u);
  assert.match(websiteHtml, /id="site-menu-toggle"/u);
  assert.match(websiteHtml, />Über X Client</u);
  assert.doesNotMatch(websiteHtml, /site-menu-kicker/u);
  assert.match(websiteHtml, /href="downloads\.html"[^>]*>[\s\S]*?<strong>Jetzt spielen<\/strong>/u);
  assert.match(featuresHtml, /href="features\.html" aria-current="page"/u);
  assert.match(downloadsHtml, /href="downloads\.html" aria-current="page"/u);
  assert.match(downloadsHtml, /id="download"/u);
  assert.doesNotMatch(websiteCss, /site-menu-toggle\[aria-expanded="true"\]/u);
  assert.match(websiteCss, /\.site-menu\.is-open \.site-menu-backdrop/u);
  assert.match(websiteCss, /strong, b, h1, h2, h3, h4, h5, h6/u);
  assert.match(websiteCss, /fonts\/Minecraft\.otf/u);
  assert.match(websiteCss, /body, body \* \{ font-weight: 400 !important; \}/u);
  assert.match(websiteCss, /\.live-stats, \.live-stats strong, \.live-stats small, \.download, \.download strong, \.download small, \.secondary \{ font-family: Inter/u);
  assert.match(websiteCss, /\.live-stats strong \{ font-weight: 900 !important; \}/u);
  assert.match(websiteCss, /\.live-stats small \{ font-weight: 800 !important; \}/u);
  assert.ok(fs.existsSync(path.join(projectRoot, 'docs', 'fonts', 'Minecraft.otf')));
});
