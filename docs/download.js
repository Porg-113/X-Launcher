'use strict';
const repository = 'https://github.com/Porg-113/X-Launcher';
const languagePicker = document.querySelector('#language-select');
const translated = [...document.querySelectorAll('[data-en]')].map(element => ({element, de: element.innerHTML, en: element.dataset.en}));
let language = 'de';
let languageMode = 'auto';
function browserLanguage() { return (navigator.languages || [navigator.language]).some(value => /^de\b/i.test(value)) ? 'de' : 'en'; }
let releaseState = null;
function renderRelease() {
  const button = document.querySelector('#download');
  const info = document.querySelector('#release-info');
  if (!button || !info || !releaseState) return;
  const version = document.querySelector('#release-version');
  const size = document.querySelector('#release-size');
  const panel = document.querySelector('.download-panel');
  if (releaseState.asset) {
    button.href = releaseState.asset.browser_download_url;
    button.textContent = language === 'de' ? 'Windows-Installer herunterladen' : 'Download Windows installer';
    if (version) version.textContent = releaseState.tag;
    if (size) size.textContent = `${(releaseState.asset.size / 1024 / 1024).toFixed(0)} MiB`;
    if (panel) panel.dataset.releaseState = 'ready';
    info.textContent = language === 'de' ? 'Download direkt aus dem aktuellen GitHub Release.' : 'Download directly from the latest GitHub release.';
  } else {
    if (version) version.textContent = '—';
    if (size) size.textContent = '—';
    if (panel) panel.dataset.releaseState = 'unavailable';
    button.href = repository + '/releases';
    button.textContent = language === 'de' ? 'Releases auf GitHub ansehen' : 'View releases on GitHub';
    info.textContent = language === 'de' ? 'Kein aktueller Installer verifiziert. Bitte prüfe die verfügbaren Releases auf GitHub.' : 'No current installer verified. Please check the available releases on GitHub.';
  }
}
function applyLanguage(value) {
  languageMode = ['de', 'en'].includes(value) ? value : 'auto';
  language = languageMode === 'auto' ? browserLanguage() : languageMode;
  document.documentElement.lang = language;
  languagePicker.value = languageMode;
  translated.forEach(({element, de, en}) => { element.innerHTML = language === 'en' ? en : de; });
  renderRelease();
}
try { applyLanguage(localStorage.getItem('x-client-language') || 'auto'); } catch { applyLanguage('auto'); }
languagePicker?.addEventListener('change', () => {
  applyLanguage(languagePicker.value);
  try { localStorage.setItem('x-client-language', languageMode); } catch { /* Site remains usable without storage. */ }
});
if (document.querySelector('#download')) {
  (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('https://api.github.com/repos/Porg-113/X-Launcher/releases/latest', {headers:{Accept:'application/vnd.github+json'},signal:controller.signal});
      if (!response.ok) throw new Error('Release unavailable');
      const release = await response.json();
      if (release.draft || release.prerelease || !Array.isArray(release.assets)) throw new Error('No stable release');
      const asset = release.assets.find(asset => /^X-(?:Launcher|Client)-[\d.]+-x64\.exe$/i.test(asset.name) && asset.state === 'uploaded' && asset.size > 0 && typeof asset.browser_download_url === 'string' && asset.browser_download_url.startsWith(repository + '/releases/download/'));
      if (!asset) throw new Error('No supported installer');
      releaseState = {asset,tag:release.tag_name};
    } catch { releaseState = {}; }
    finally { clearTimeout(timeout); renderRelease(); }
  })();
}

window.addEventListener('languagechange', () => { if (languageMode === 'auto') applyLanguage('auto'); });

// Motion enhances visible content; nothing is hidden while waiting for JavaScript.
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const runningAnimations = new Set();
let entranceObserver;
function animateEntrance(element, delay = 0) {
  if (motionPreference.matches || !element.animate) return;
  const animation = element.animate([
    { opacity: 1, transform: 'translateY(22px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration: 650, delay, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'backwards' });
  runningAnimations.add(animation);
  animation.finished.catch(() => {}).finally(() => runningAnimations.delete(animation));
}
if (!motionPreference.matches && 'IntersectionObserver' in window) {
  document.querySelectorAll('.hero-copy > *, .page-intro > *').forEach((element, index) => animateEntrance(element, index * 75));
  entranceObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const siblings = [...entry.target.parentElement.children];
      animateEntrance(entry.target, Math.min(siblings.indexOf(entry.target), 3) * 70);
      entranceObserver.unobserve(entry.target);
    });
  }, { threshold: .08 });
  document.querySelectorAll('.section-heading, .card, .info-card, .steps li, .callout, .download-panel').forEach(element => entranceObserver.observe(element));
}
motionPreference.addEventListener('change', event => {
  if (!event.matches) return;
  entranceObserver?.disconnect();
  runningAnimations.forEach(animation => animation.cancel());
  runningAnimations.clear();
});
