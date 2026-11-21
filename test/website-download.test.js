'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const directory = path.join(__dirname, '../docs');
const html = fs.readFileSync(path.join(directory, 'downloads.html'), 'utf8');
const script = fs.readFileSync(path.join(directory, 'download.js'), 'utf8');
const fallback = html.match(/id="download" href="([^"]+)"/)[1];

async function loadPage(fetch) {
  const elements = {
    '#download': { href: fallback, textContent: 'Download' },
    '#release-info': {}, '#release-version': {}, '#release-size': {},
    '.download-panel': { dataset: {} }
  };
  vm.runInNewContext(script, {
    document: {
      documentElement: {},
      querySelector: selector => elements[selector],
      querySelectorAll: () => []
    },
    location: { protocol: 'file:' },
    navigator: { languages: ['de-CH'] },
    window: {
      addEventListener() {},
      matchMedia: () => ({ matches: true, addEventListener() {} })
    },
    fetch, AbortController, setTimeout, clearTimeout
  });
  await new Promise(resolve => setImmediate(resolve));
  return elements;
}

test('download selects the newest stable installer instead of a portable build', async () => {
  const url = 'https://github.com/Porg-113/X-Launcher/releases/download/v9.0.0/X-9.0.0.exe';
  const elements = await loadPage(async () => ({
    ok: true,
    json: async () => ({
      tag_name: 'v9.0.0',
      assets: [
        { name: 'X-Launcher-Portable-9.0.0.exe', state: 'uploaded', size: 50, browser_download_url: url + '?portable' },
        { name: 'X-9.0.0.exe', state: 'uploaded', size: 1048576, browser_download_url: url }
      ]
    })
  }));
  assert.equal(elements['#download'].href, url);
  assert.equal(elements['#download'].textContent, 'Download');
  assert.equal(elements['#release-version'].textContent, 'v9.0.0');
});

test('API failures keep a direct installer download and never switch to the release list', async () => {
  assert.match(fallback, /^https:\/\/github\.com\/Porg-113\/X-Launcher\/releases\/download\/[^/]+\/[^/]+\.exe$/);
  assert.match(html, /id="download"[^>]*>Download<\/a>/);
  for (const fetch of [
    async () => { throw new Error('Network unavailable'); },
    async () => ({ ok: false, status: 403 }),
    async () => ({ ok: true, json: async () => ({ assets: [] }) })
  ]) {
    const elements = await loadPage(fetch);
    assert.equal(elements['#download'].href, fallback);
    assert.equal(elements['#download'].textContent, 'Download');
    assert.equal(elements['.download-panel'].dataset.releaseState, 'fallback');
  }
});
