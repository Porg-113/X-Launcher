'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { prepareHtml } = require('../scripts/build-website');

test('website routes stay short while assets retain cache versions at every depth', () => {
  const html = '<a href="index.html">Home</a><a href="downloads.html#download">Download</a><a href="features.html">Feature</a><link href="styles.css"><img src="x-client.png"><script src="download.js"></script><a href="https://github.com/Porg-113/X-Launcher">Source</a><a href="https://x-client.printify.me/">Shop</a>';
  for (const [base, depth] of [['https://porg-113.github.io/X-Launcher/', 0], ['https://porg-113.github.io/X-Launcher/download/', 1]]) {
    const output = prepareHtml(html, 'test-release', depth);
    const links = [...output.matchAll(/href="([^"]+)"/gu)].map(match => new URL(match[1], base));
    assert.equal(links[0].href, 'https://porg-113.github.io/X-Launcher/');
    assert.equal(links[1].href, 'https://porg-113.github.io/X-Launcher/download/#download');
    assert.equal(links[2].href, 'https://porg-113.github.io/X-Launcher/feature/');
    assert.equal(links[3].href, 'https://porg-113.github.io/X-Launcher/styles.css?v=test-release');
    assert.equal(links[4].href, 'https://github.com/Porg-113/X-Launcher');
    assert.equal(links[5].href, 'https://x-client.printify.me/');
    const assets = [...output.matchAll(/src="([^"]+)"/gu)].map(match => new URL(match[1], base));
    for (const asset of assets) {
      assert.equal(asset.searchParams.get('v'), 'test-release');
      assert.equal(asset.pathname.split('/').length, 3);
    }
  }
});

test('all pages link directly to the Printify shop in the same tab and use clean canonicals', () => {
  for (const [file, route, depth] of [['index.html', '', 0], ['downloads.html', 'download/', 1], ['features.html', 'feature/', 1]]) {
    const source = fs.readFileSync(path.join(__dirname, '../docs', file), 'utf8');
    const html = prepareHtml(source, 'test-release', depth);
    const nav = html.match(/<nav aria-label="Navigation">([\s\S]*?)<\/nav>/u)[1];
    assert.deepEqual([...nav.matchAll(/<a[^>]*>([^<]+)<\/a>/gu)].map(match => match[1]), ['Home', 'Feature', 'Download', 'Shop']);
    assert.doesNotMatch(nav, /\.html|\?v=/u);
    assert.ok(html.includes('rel="canonical" href="https://porg-113.github.io/X-Launcher/' + route + '"'));
    assert.match(nav, /aria-current="page"/u);
    assert.match(nav, /<a href="https:\/\/x-client\.printify\.me\/">Shop<\/a>/u);
    assert.doesNotMatch(nav, /target=/u);
  }
});
