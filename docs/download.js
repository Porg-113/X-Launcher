'use strict';
// Keep legacy bookmarks working while showing short, canonical page addresses.
if (location.protocol === 'http:' || location.protocol === 'https:') {
  const currentUrl = new URL(location.href);
  const legacyPages = { 'index.html': './', 'shop.html': 'https://x-client.printify.me/' };
  const legacyTarget = legacyPages[currentUrl.pathname.split('/').pop()];
  if (legacyTarget) {
    const target = new URL(legacyTarget, currentUrl);
    target.hash = currentUrl.hash;
    location.replace(target.href);
  } else if (currentUrl.searchParams.has('v')) {
    currentUrl.searchParams.delete('v');
    history.replaceState(null, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
  }
}

const repository = 'https://github.com/Porg-113/X-Launcher';
const windowsInstallerAssetName = /^(?:X-(?:Launcher|Client)-[\d.]+-x64|X-[\d.]+)\.exe$/i;
const translated = [...document.querySelectorAll('[data-en]')].map(element => ({element, de: element.innerHTML, en: element.dataset.en}));
let language = 'de';
function browserLanguage() {
  const preferences = [...(navigator.languages || []), navigator.language];
  for (const preference of preferences) {
    const supported = /^(de|en)(?:-|$)/i.exec(preference || '');
    if (supported) return supported[1].toLowerCase();
  }
  return 'en';
}
let releaseState = null;
let pendingLatestDownload = null;
const latestDownloadButtons = [...document.querySelectorAll('#download, [data-latest-download]')];
function renderRelease() {
  const button = document.querySelector('#download');
  const info = document.querySelector('#release-info');
  if (!button || !info || !releaseState) return;
  const version = document.querySelector('#release-version');
  const size = document.querySelector('#release-size');
  const panel = document.querySelector('.download-panel');
  if (releaseState.asset) {
    latestDownloadButtons.forEach(downloadButton => { downloadButton.href = releaseState.asset.browser_download_url; });
    if (version) version.textContent = releaseState.tag;
    if (size) size.textContent = `${(releaseState.asset.size / 1024 / 1024).toFixed(0)} MiB`;
    if (panel) panel.dataset.releaseState = 'ready';
    info.textContent = language === 'de' ? 'Download direkt aus dem aktuellen GitHub Release.' : 'Download directly from the latest GitHub release.';
  } else {
    if (version) version.textContent = '—';
    if (size) size.textContent = '—';
    if (panel) panel.dataset.releaseState = 'fallback';
    // Keep the direct installer link from the HTML when GitHub's API is unavailable.
    info.textContent = language === 'de' ? 'Die neueste Version konnte nicht abgefragt werden. Download lädt den zuletzt hinterlegten Installer herunter.' : 'Could not check the latest version. Download gets the last known installer.';
  }
  if (pendingLatestDownload) {
    const downloadButton = pendingLatestDownload;
    pendingLatestDownload = false;
    downloadButton.removeAttribute('aria-busy');
    window.location.assign(downloadButton.href);
  }
}
function applyLanguage() {
  language = browserLanguage();
  document.documentElement.lang = language;
  translated.forEach(({element, de, en}) => { element.innerHTML = language === 'en' ? en : de; });
  renderRelease();
}
applyLanguage();
if (latestDownloadButtons.length) {
  latestDownloadButtons.forEach(downloadButton => downloadButton.addEventListener('click', event => {
    if (releaseState === null) {
      event.preventDefault();
      pendingLatestDownload = downloadButton;
      downloadButton.setAttribute('aria-busy', 'true');
    }
  }));
  (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('https://api.github.com/repos/Porg-113/X-Launcher/releases/latest', {headers:{Accept:'application/vnd.github+json'},signal:controller.signal});
      if (!response.ok) throw new Error('Release unavailable');
      const release = await response.json();
      if (release.draft || release.prerelease || !Array.isArray(release.assets)) throw new Error('No stable release');
      const asset = release.assets.find(asset => windowsInstallerAssetName.test(asset.name) && asset.state === 'uploaded' && asset.size > 0 && typeof asset.browser_download_url === 'string' && asset.browser_download_url.startsWith(repository + '/releases/download/'));
      if (!asset) throw new Error('No supported installer');
      releaseState = {asset,tag:release.tag_name};
    } catch { releaseState = {}; }
    finally { clearTimeout(timeout); renderRelease(); }
  })();
}

window.addEventListener('languagechange', applyLanguage);

const openVersionsButton = document.querySelector('#open-versions');
const versionsBackdrop = document.querySelector('#versions-backdrop');
const closeVersionsButton = document.querySelector('#close-versions');
const platformError = document.querySelector('#platform-error');
let versionsCloseTimer = null;
function closeVersions() {
  if (!versionsBackdrop || versionsBackdrop.hidden) return;
  versionsBackdrop.classList.add('is-closing');
  window.clearTimeout(versionsCloseTimer);
  versionsCloseTimer = window.setTimeout(() => {
    versionsBackdrop.hidden = true;
    versionsBackdrop.classList.remove('is-closing');
    document.body.classList.remove('versions-open');
    if (platformError) platformError.textContent = '';
    openVersionsButton?.focus();
  }, 180);
}
openVersionsButton?.addEventListener('click', () => {
  if (!versionsBackdrop) return;
  window.clearTimeout(versionsCloseTimer);
  versionsBackdrop.classList.remove('is-closing');
  if (platformError) platformError.textContent = '';
  versionsBackdrop.hidden = false;
  document.body.classList.add('versions-open');
  closeVersionsButton?.focus();
});
closeVersionsButton?.addEventListener('click', closeVersions);
versionsBackdrop?.addEventListener('click', event => {
  if (event.target === versionsBackdrop) closeVersions();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeVersions();
});
document.querySelectorAll('[data-platform]').forEach(button => {
  button.addEventListener('click', () => {
    if (!platformError) return;
    platformError.textContent = `Für ${button.dataset.platform} ist derzeit kein X Client-Download verfügbar.`;
  });
});
