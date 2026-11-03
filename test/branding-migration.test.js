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

test('launcher retains its brand while the website presents X-Launcher', () => {
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
  for (const html of [websiteHtml, featuresHtml, downloadsHtml]) {
    assert.match(html, /X-Launcher/u);
    assert.equal((html.match(/<h1[ >]/gu) || []).length, 1);
    assert.match(html, /rel="canonical"/u);
    assert.match(html, /name="description"/u);
    assert.match(html, /property="og:image"/u);
  }
  assert.match(websiteHtml, /href="downloads\.html"/u);
  assert.match(downloadsHtml, /id="download"/u);
  assert.match(websiteCss, /prefers-reduced-motion/u);
  assert.match(websiteCss, /:focus-visible/u);
  assert.doesNotMatch(websiteHtml, /download-count|active-player-count/u);
});

test('website language follows browser preferences without a visible picker', () => {
  const websiteScript = read('docs/download.js');
  for (const file of ['index.html', 'features.html', 'downloads.html']) {
    assert.doesNotMatch(read('docs/' + file), /language-select|language-icon|header-tools/u);
  }
  assert.doesNotMatch(websiteScript, /localStorage|languagePicker/u);
  const detection = websiteScript.slice(websiteScript.indexOf('function browserLanguage()'), websiteScript.indexOf('let releaseState'));
  for (const [languages, fallback, expected] of [
    [['de-CH', 'en'], 'de-CH', 'de'],
    [['en-US', 'de'], 'en-US', 'en'],
    [['fr-CH', 'de-DE'], 'fr-CH', 'de'],
    [['fr', 'it'], 'fr', 'en'],
    [[], 'de-AT', 'de']
  ]) {
    const actual = require('node:vm').runInNewContext(detection + 'browserLanguage()', { navigator: { languages, language: fallback } });
    assert.equal(actual, expected);
  }
  assert.match(websiteScript, /window\.addEventListener\('languagechange', applyLanguage\)/u);
});

test('website has cyan accents, detailed features and no application preview', () => {
  const home = read('docs/index.html');
  const css = read('docs/styles.css');
  assert.doesNotMatch(home, /<iframe|class="preview"|mock-app|Schematische CSS/u);
  assert.match(css, /--accent: rgb\(0, 255, 255\)/u);
  assert.equal((home.match(/class="card"/gu) || []).length, 6);
  assert.equal((home.match(/class="info-card"/gu) || []).length, 4);
  assert.equal((home.match(/class="detail-list"/gu) || []).length, 6);
  assert.match(css, /prefers-reduced-motion/u);
  for (const file of ['index.html', 'features.html', 'downloads.html']) {
    const html = read('docs/' + file);
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    assert.doesNotMatch(header, /github\.com/u);
    for (const match of html.matchAll(/(?:href|src)="([^"?#]+)(?:[?#][^"]*)?"/gu)) {
      if (/^(?:https?:|#)/u.test(match[1])) continue;
      assert.ok(!match[1].startsWith('/'));
      assert.ok(fs.existsSync(path.join(projectRoot, 'docs', match[1])), match[1]);
    }
  }
});
