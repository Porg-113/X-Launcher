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
  assert.match(websiteHtml, /href="downloads\.html"[^>]*>[\s\S]*?<strong[^>]*>Jetzt spielen<\/strong>/u);
  assert.doesNotMatch(websiteHtml, /Zur Download-Seite/u);
  assert.match(featuresHtml, /href="features\.html" aria-current="page"/u);
  assert.match(featuresHtml, /class="download play-now"/u);
  assert.doesNotMatch(featuresHtml, /Zur Download-Seite/u);
  assert.match(downloadsHtml, /href="downloads\.html" aria-current="page"/u);
  assert.match(downloadsHtml, /id="download"/u);
  assert.doesNotMatch(downloadsHtml, /download-facts/u);
  assert.doesNotMatch(downloadsHtml, /download-shell-logo/u);
  assert.doesNotMatch(downloadsHtml, /Download X Client, sign in with Microsoft/u);
  assert.match(downloadsHtml, /class="download-shell-title"[^>]*data-i18n="downloads\.heading"/u);
  assert.doesNotMatch(websiteCss, /site-menu-toggle\[aria-expanded="true"\]/u);
  assert.match(websiteCss, /\.site-menu\.is-open \.site-menu-backdrop/u);
  assert.match(websiteCss, /strong, b, h1, h2, h3, h4, h5, h6/u);
  assert.match(websiteCss, /fonts\/Minecraft\.otf/u);
  assert.match(websiteCss, /body, body \* \{ font-weight: 400 !important; \}/u);
  assert.match(websiteCss, /\.live-stats, \.live-stats strong, \.live-stats small, \.download, \.download strong, \.download small, \.secondary \{ font-family: Inter/u);
  assert.match(websiteCss, /\.live-stats strong \{ font-weight: 900 !important; \}/u);
  assert.match(websiteCss, /\.live-stats small \{ font-weight: 800 !important; \}/u);
  assert.match(websiteCss, /\.play-now strong \{ font-weight: 800 !important; \}/u);
  assert.ok(fs.existsSync(path.join(projectRoot, 'docs', 'fonts', 'Minecraft.otf')));
});

test('website language is automatic and can be selected from every menu', () => {
  const websiteScript = read(path.join('docs', 'download.js'));
  const pages = ['index.html', 'features.html', 'downloads.html']
    .map((fileName) => read(path.join('docs', fileName)));

  for (const page of pages) {
    assert.match(page, /class="site-menu-footer"/u);
    assert.match(page, /id="language-select"/u);
    assert.match(page, /option value="auto"/u);
    assert.match(page, /option value="de"/u);
    assert.match(page, /option value="en"/u);
  }

  assert.match(websiteScript, /navigator\.languages/u);
  assert.match(websiteScript, /localStorage\.setItem\(languageStorageKey/u);
  assert.match(websiteScript, /localStorage\.removeItem\(languageStorageKey/u);
  assert.match(websiteScript, /window\.addEventListener\("languagechange"/u);
  assert.match(websiteScript, /document\.documentElement\.lang = currentLanguage/u);
});

test('website preview is interactive while unsafe demo actions stay locked', () => {
  const homePage = read(path.join('docs', 'index.html'));
  const featuresPage = read(path.join('docs', 'features.html'));
  const previewPage = read(path.join('docs', 'launcher-preview.html'));
  const previewScript = read(path.join('docs', 'launcher-preview.js'));
  const previewSkin = fs.readFileSync(path.join(projectRoot, 'docs', 'assets', 'skins', 'i-am-steve.png'));

  assert.match(homePage, /id="app-preview"[^>]+launcher-preview\.html\?v=28/u);
  assert.match(homePage, /id="legacy-app-preview"[^>]+hidden/u);
  assert.match(previewPage, /id="main-screen" class="screen active"/u);
  assert.match(previewPage, /id="username-display"[^>]*>X Client<\/button>/u);
  assert.match(previewPage, /assets\/skins\/i-am-steve\.png/u);
  assert.match(previewPage, /data-skin-name="i-am-steve"/u);
  assert.match(previewPage, /class="dashboard-skin-stage"/u);
  assert.equal(read(path.join('docs', 'launcher-preview-base.css')), read('styles.css'));
  assert.equal(read(path.join('docs', 'launcher-preview-theme.css')), read('modern-launcher.css'));
  assert.deepEqual([...previewSkin.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.doesNotMatch(homePage, /class="feature-story"/u);
  assert.match(featuresPage, /class="feature-story feature-story-page"/u);
  assert.match(previewScript, /nav-item\[data-section\]/u);
  assert.match(previewScript, /nothing installed|nichts installiert/u);
  assert.match(previewScript, /nichts gelöscht/u);
  assert.match(previewScript, /keine Dateien erstellt, importiert oder exportiert/u);
  assert.match(previewScript, /SkinViewer/u);
  assert.doesNotMatch(previewScript, /fetch\(|window\.api|electronAPI|XMLHttpRequest/u);
});
