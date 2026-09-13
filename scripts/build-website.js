#!/usr/bin/env node

/**
 * Copies the static website into a deployable directory and gives every local
 * asset URL a content-derived version. GitHub Pages (and browsers) can then
 * cache images, CSS and JavaScript without serving an older site after a
 * deploy.
 */
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceDirectory = path.join(projectRoot, 'docs');
const outputDirectory = path.join(projectRoot, 'site');
const cacheableExtensions = /\.(?:avif|css|gif|ico|jpe?g|js|otf|png|svg|ttf|webp|woff2?)$/i;

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const paths = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await walk(entryPath));
    } else if (entry.isFile()) {
      paths.push(entryPath);
    }
  }

  return paths.sort();
}

async function createVersion() {
  const hash = crypto.createHash('sha256');
  const files = await walk(sourceDirectory);

  for (const file of files) {
    hash.update(path.relative(sourceDirectory, file));
    hash.update(await fs.readFile(file));
  }

  return hash.digest('hex').slice(0, 12);
}

function isLocalUrl(url) {
  return url && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url);
}

function withVersion(url, version) {
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : url.slice(hashIndex);
  const queryIndex = beforeHash.indexOf('?');
  const pathname = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  const query = new URLSearchParams(queryIndex === -1 ? '' : beforeHash.slice(queryIndex + 1));

  query.set('v', version);
  return `${pathname}?${query}${fragment}`;
}

function cacheBustHtml(html, version) {
  return html.replace(/\b(href|src)=(['\"])([^'\"]+)\2/gi, (match, attribute, quote, url) => {
    if (!isLocalUrl(url)) return match;

    const pathname = url.split(/[?#]/, 1)[0];
    const isCacheableAsset = cacheableExtensions.test(pathname);
    const isEmbeddedDocument = attribute.toLowerCase() === 'src' && /\.html$/i.test(pathname);

    if (!isCacheableAsset && !isEmbeddedDocument) return match;
    return `${attribute}=${quote}${withVersion(url, version)}${quote}`;
  });
}

async function main() {
  const version = await createVersion();
  await fs.rm(outputDirectory, { recursive: true, force: true });
  await fs.cp(sourceDirectory, outputDirectory, { recursive: true });

  const files = await walk(outputDirectory);
  await Promise.all(files
    .filter((file) => path.extname(file).toLowerCase() === '.html')
    .map(async (file) => {
      const html = await fs.readFile(file, 'utf8');
      await fs.writeFile(file, cacheBustHtml(html, version));
    }));

  console.log(`Website built in site/ (asset version ${version}).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
