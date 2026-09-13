const repo = "Porg-113/X-Launcher";
const primary = document.querySelector("#download");
const info = document.querySelector("#release-info");
const downloadCount = document.querySelector("#download-count");
const activePlayerCount = document.querySelector("#active-player-count");
const siteMenu = document.querySelector("#site-menu");
const siteMenuToggle = document.querySelector("#site-menu-toggle");
const siteMenuPanel = siteMenu?.querySelector(".site-menu-panel");
const languageSelect = document.querySelector("#language-select");

const languageStorageKey = "x-client-language";
const translations = {
  de: {
    "common.communityNav": "Community und Quellcode",
    "common.openMenu": "Menü öffnen",
    "common.closeMenu": "Menü schließen",
    "common.menuTitle": "Über X Client",
    "common.menuCopy": "Ein schneller, persönlicher Minecraft-Client mit Mods, Profilen, Skins und direktem Spielstart – alles an einem Ort.",
    "common.siteNav": "Seitennavigation",
    "common.home": "Startseite",
    "common.features": "Features",
    "common.downloads": "Downloads",
    "common.language": "Sprache",
    "common.auto": "Automatisch",
    "common.playNow": "Jetzt spielen",
    "common.disclaimer": "Nicht mit Mojang oder Microsoft verbunden.",
    "preview.eyebrow": "Interaktive App-Vorschau",
    "preview.title": "X Client ausprobieren",
    "preview.copy": "Entdecke die App – ohne echte Änderungen an deinem PC.",
    "preview.demoMode": "Demo-Modus",
    "preview.online": "Online",
    "preview.loggedIn": "Angemeldet als",
    "preview.demoAccount": "Demo-Konto",
    "preview.navigation": "App-Navigation",
    "preview.home": "Start",
    "preview.profiles": "Profile",
    "preview.settings": "Einstellungen",
    "preview.welcome": "Willkommen zurück",
    "preview.ready": "Bereit",
    "preview.readyToPlay": "Bereit zum Spielen",
    "preview.optimized": "Optimiert",
    "preview.integrated": "Integriert",
    "preview.yourMinecraft": "Dein Minecraft",
    "preview.launchCopy": "Profil wählen und direkt loslegen.",
    "preview.profile": "Profil",
    "preview.play": "Minecraft starten",
    "preview.active": "Aktiv",
    "preview.saved": "Gespeichert",
    "preview.manageMods": "Mods verwalten",
    "preview.checkAll": "Alle prüfen",
    "preview.checked": "Geprüft",
    "preview.safeCheck": "Alle Demo-Mods wurden geprüft.",
    "preview.all": "Alle",
    "preview.performance": "Performance",
    "preview.visual": "Grafik",
    "preview.searchMods": "Mods suchen …",
    "preview.search": "Suchen",
    "preview.performanceMod": "Performance-Mod",
    "preview.shaderSupport": "Shader-Unterstützung",
    "preview.modSettings": "Mod-Einstellungen",
    "preview.install": "Installieren",
    "preview.import": "Importieren",
    "preview.create": "Erstellen",
    "preview.export": "Ausgewähltes Profil exportieren",
    "preview.exportShort": "Exportieren",
    "preview.addServer": "Server hinzufügen",
    "preview.selectedServer": "Ausgewählter Server",
    "preview.serverReady": "Verbindung bereit",
    "preview.join": "Beitreten",
    "preview.collection": "Sammlung",
    "preview.activeSkin": "Aktiver Skin",
    "preview.appearance": "Darstellung",
    "preview.accentColor": "Akzentfarbe",
    "preview.behavior": "Verhalten",
    "preview.animations": "Animationen",
    "preview.sounds": "Sounds",
    "preview.noResults": "Keine Ergebnisse gefunden.",
    "preview.locked.play": "Im Demo-Modus wird Minecraft nicht gestartet.",
    "preview.locked.install": "Im Demo-Modus wird nichts installiert.",
    "preview.locked.delete": "Im Demo-Modus wird nichts gelöscht.",
    "preview.locked.create": "Im Demo-Modus wird nichts erstellt.",
    "preview.locked.transfer": "Import und Export sind im Demo-Modus gesperrt.",
    "home.meta": "X Client – der moderne Minecraft Fabric Client für Windows.",
    "home.title": "X Client – Startseite",
    "home.eyebrow": "Für Windows 10 & 11",
    "home.lead": "Minecraft das ganz dir gehört",
    "home.statsLabel": "Live-Statistiken",
    "home.active": "Aktiv",
    "home.discoverFeatures": "Features entdecken",
    "home.hint": "Kostenlos · 64-Bit · Direkter Download vom offiziellen GitHub Release",
    "home.feature1Title": "Modrinth integriert",
    "home.feature1Copy": "Suche und installiere Mods, Modpacks, Shader sowie Ressourcenpakete direkt im Launcher – passend zu deiner Fabric-Version.",
    "home.feature2Title": "Profile und Skins",
    "home.feature2Copy": "Erstelle Profile mit getrennten Mods-Ordnern. Importiere eigene Skins und sieh sie direkt in der Vorschau an.",
    "home.feature3Title": "Server und Updates",
    "home.feature3Copy": "Speichere Server-Favoriten und starte sie direkt. Installierte Launcher-Versionen suchen automatisch nach neuen Updates.",
    "home.scene2Title1": "Microsoft-Anmeldung",
    "home.scene2Copy1": "Melde dich über Microsoft und Xbox an oder verwende den Offline-Modus. Danach kannst du Minecraft direkt starten.",
    "home.scene2Title2": "Fabric-Versionen",
    "home.scene2Copy2": "Wähle und verwalte unterschiedliche Minecraft-Versionen mit Fabric Mod Loader direkt in deinen Profilen.",
    "home.scene2Title3": "Mods automatisch anpassen",
    "home.scene2Copy3": "Der Launcher erkennt verwaltete Mods und kann sie gemeinsam auf eine ausgewählte Minecraft-Version abstimmen.",
    "home.scene3Title1": "Alles übersichtlich",
    "home.scene3Copy1": "Mods, Shader und Ressourcenpakete erscheinen in getrennten Ansichten und lassen sich mit wenigen Klicks verwalten.",
    "home.scene3Title2": "Dein eigener Look",
    "home.scene3Copy2": "Importiere einen Minecraft-Skin und kontrolliere ihn direkt in der integrierten dreidimensionalen Vorschau.",
    "home.scene3Title3": "Automatisch aktuell",
    "home.scene3Copy3": "Die installierte Windows-Version prüft GitHub Releases auf Updates und installiert sie nach einem Neustart.",
    "features.meta": "Entdecke die Funktionen von X Client für Minecraft Java.",
    "features.title": "X Client – Features",
    "features.eyebrow": "Alles in einem Client",
    "features.heading1": "Mehr spielen.",
    "features.heading2": "Weniger verwalten.",
    "features.copy": "X Client verbindet deine Minecraft-Versionen, Mods, Profile, Skins und Server in einer schnellen, aufgeräumten Oberfläche.",
    "features.card1Title": "Modrinth direkt integriert",
    "features.card1Copy": "Finde Mods, Modpacks, Shader und Ressourcenpakete und installiere sie passend zu deiner Fabric-Version.",
    "features.card2Title": "Jede Version sauber getrennt",
    "features.card2Copy": "Erstelle eigene Profile mit getrennten Mods und Einstellungen, ohne Dateien von Hand verschieben zu müssen.",
    "features.card3Title": "Dein Look vor dem Start",
    "features.card3Copy": "Importiere Skins, speichere deine Favoriten und kontrolliere dein Aussehen direkt in der Vorschau.",
    "features.card4Title": "Schneller zusammen spielen",
    "features.card4Copy": "Speichere Server, starte Favoriten direkt und verwalte eigene Welten für deine Freunde.",
    "features.card5Title": "Automatisch aktuell",
    "features.card5Copy": "X Client sucht nach neuen Versionen und bereitet Updates vor, ohne deinen Spielfluss zu unterbrechen.",
    "features.card6Title": "Für dein Minecraft gebaut",
    "features.card6Copy": "Wähle deine Fabric-Version und lass X Client verwaltete Mods automatisch aufeinander abstimmen.",
    "downloads.meta": "Lade X Client für Minecraft Java unter Windows herunter.",
    "downloads.title": "X Client – Downloads",
    "downloads.eyebrow": "Kostenlos für Windows",
    "downloads.heading": "Deine Welt wartet.",
    "downloads.clientTitle": "X Client für Windows",
    "downloads.clientCopy": "Der Installer richtet alles ein und hält deinen Client anschließend automatisch aktuell.",
    "downloads.download": "Download",
    "downloads.loading": "Neueste Version wird geladen …",
    "downloads.github": "Neueste Version auf GitHub ansehen",
    "downloads.installation": "Installation",
    "downloads.step1Title": "Herunterladen",
    "downloads.step1Copy": "Lade den aktuellen Windows-Installer direkt vom offiziellen GitHub Release.",
    "downloads.step2Title": "Installieren",
    "downloads.step2Copy": "Öffne die Datei und wähle den gewünschten Installationsordner.",
    "downloads.step3Title": "Losspielen",
    "downloads.step3Copy": "Starte X Client, wähle dein Profil und betrete deine Minecraft-Welt."
  },
  en: {
    "common.communityNav": "Community and source code",
    "common.openMenu": "Open menu",
    "common.closeMenu": "Close menu",
    "common.menuTitle": "About X Client",
    "common.menuCopy": "A fast, personal Minecraft client with mods, profiles, skins, and instant game launch – all in one place.",
    "common.siteNav": "Site navigation",
    "common.home": "Home",
    "common.features": "Features",
    "common.downloads": "Downloads",
    "common.language": "Language",
    "common.auto": "Automatic",
    "common.playNow": "Play now",
    "common.disclaimer": "Not affiliated with Mojang or Microsoft.",
    "preview.eyebrow": "Interactive app preview",
    "preview.title": "Try X Client",
    "preview.copy": "Explore the app without making real changes to your PC.",
    "preview.demoMode": "Demo mode",
    "preview.online": "Online",
    "preview.loggedIn": "Signed in as",
    "preview.demoAccount": "Demo account",
    "preview.navigation": "App navigation",
    "preview.home": "Home",
    "preview.profiles": "Profiles",
    "preview.settings": "Settings",
    "preview.welcome": "Welcome back",
    "preview.ready": "Ready",
    "preview.readyToPlay": "Ready to play",
    "preview.optimized": "Optimized",
    "preview.integrated": "Integrated",
    "preview.yourMinecraft": "Your Minecraft",
    "preview.launchCopy": "Choose a profile and get ready to play.",
    "preview.profile": "Profile",
    "preview.play": "Launch Minecraft",
    "preview.active": "Active",
    "preview.saved": "Saved",
    "preview.manageMods": "Manage mods",
    "preview.checkAll": "Check all",
    "preview.checked": "Checked",
    "preview.safeCheck": "All demo mods were checked.",
    "preview.all": "All",
    "preview.performance": "Performance",
    "preview.visual": "Visual",
    "preview.searchMods": "Search mods …",
    "preview.search": "Search",
    "preview.performanceMod": "Performance mod",
    "preview.shaderSupport": "Shader support",
    "preview.modSettings": "Mod settings",
    "preview.install": "Install",
    "preview.import": "Import",
    "preview.create": "Create",
    "preview.export": "Export selected profile",
    "preview.exportShort": "Export",
    "preview.addServer": "Add server",
    "preview.selectedServer": "Selected server",
    "preview.serverReady": "Connection ready",
    "preview.join": "Join",
    "preview.collection": "Collection",
    "preview.activeSkin": "Active skin",
    "preview.appearance": "Appearance",
    "preview.accentColor": "Accent color",
    "preview.behavior": "Behavior",
    "preview.animations": "Animations",
    "preview.sounds": "Sounds",
    "preview.noResults": "No results found.",
    "preview.locked.play": "Minecraft does not launch in demo mode.",
    "preview.locked.install": "Nothing is installed in demo mode.",
    "preview.locked.delete": "Nothing is deleted in demo mode.",
    "preview.locked.create": "Nothing is created in demo mode.",
    "preview.locked.transfer": "Import and export are locked in demo mode.",
    "home.meta": "X Client – the modern Minecraft Fabric client for Windows.",
    "home.title": "X Client – Home",
    "home.eyebrow": "For Windows 10 & 11",
    "home.lead": "Minecraft that's entirely yours",
    "home.statsLabel": "Live statistics",
    "home.active": "Active",
    "home.discoverFeatures": "Explore features",
    "home.hint": "Free · 64-bit · Direct download from the official GitHub release",
    "home.feature1Title": "Modrinth built in",
    "home.feature1Copy": "Find and install mods, modpacks, shaders, and resource packs that match your Fabric version.",
    "home.feature2Title": "Profiles and skins",
    "home.feature2Copy": "Create profiles with separate mod folders. Import your own skins and preview them instantly.",
    "home.feature3Title": "Servers and updates",
    "home.feature3Copy": "Save favorite servers and launch them directly. Installed client versions check for updates automatically.",
    "home.scene2Title1": "Microsoft sign-in",
    "home.scene2Copy1": "Sign in with Microsoft and Xbox or use offline mode, then launch Minecraft directly.",
    "home.scene2Title2": "Fabric versions",
    "home.scene2Copy2": "Choose and manage different Minecraft versions with Fabric Mod Loader inside your profiles.",
    "home.scene2Title3": "Automatic mod matching",
    "home.scene2Copy3": "X Client recognizes managed mods and can match them to your selected Minecraft version.",
    "home.scene3Title1": "Everything organized",
    "home.scene3Copy1": "Mods, shaders, and resource packs have their own clear views and take only a few clicks to manage.",
    "home.scene3Title2": "Your own look",
    "home.scene3Copy2": "Import a Minecraft skin and inspect it in the built-in 3D preview.",
    "home.scene3Title3": "Always up to date",
    "home.scene3Copy3": "The installed Windows version checks GitHub releases and installs updates after a restart.",
    "features.meta": "Explore X Client features for Minecraft Java.",
    "features.title": "X Client – Features",
    "features.eyebrow": "Everything in one client",
    "features.heading1": "Play more.",
    "features.heading2": "Manage less.",
    "features.copy": "X Client brings your Minecraft versions, mods, profiles, skins, and servers into one fast, clean interface.",
    "features.card1Title": "Modrinth built right in",
    "features.card1Copy": "Find mods, modpacks, shaders, and resource packs and install the right build for your Fabric version.",
    "features.card2Title": "Every version stays separate",
    "features.card2Copy": "Create profiles with separate mods and settings without moving files by hand.",
    "features.card3Title": "Preview your look",
    "features.card3Copy": "Import skins, save favorites, and check your appearance in the built-in preview.",
    "features.card4Title": "Play together faster",
    "features.card4Copy": "Save servers, launch favorites directly, and manage worlds for your friends.",
    "features.card5Title": "Always up to date",
    "features.card5Copy": "X Client checks for new versions and prepares updates without interrupting your game.",
    "features.card6Title": "Built for your Minecraft",
    "features.card6Copy": "Choose your Fabric version and let X Client keep managed mods compatible.",
    "downloads.meta": "Download X Client for Minecraft Java on Windows.",
    "downloads.title": "X Client – Downloads",
    "downloads.eyebrow": "Free for Windows",
    "downloads.heading": "Your world is waiting.",
    "downloads.clientTitle": "X Client for Windows",
    "downloads.clientCopy": "The installer sets everything up and keeps your client updated automatically.",
    "downloads.download": "Download",
    "downloads.loading": "Loading the latest version …",
    "downloads.github": "View the latest version on GitHub",
    "downloads.installation": "Installation",
    "downloads.step1Title": "Download",
    "downloads.step1Copy": "Get the current Windows installer directly from the official GitHub release.",
    "downloads.step2Title": "Install",
    "downloads.step2Copy": "Open the file and choose your preferred installation folder.",
    "downloads.step3Title": "Play",
    "downloads.step3Copy": "Launch X Client, choose your profile, and enter your Minecraft world."
  }
};

function detectBrowserLanguage() {
  const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const language of browserLanguages) {
    const normalized = String(language).toLowerCase();
    if (normalized.startsWith("de")) return "de";
    if (normalized.startsWith("en")) return "en";
  }
  return "en";
}

function readLanguageMode() {
  try {
    const stored = localStorage.getItem(languageStorageKey);
    return stored === "de" || stored === "en" ? stored : "auto";
  } catch (_) {
    return "auto";
  }
}

let languageMode = readLanguageMode();
let currentLanguage = languageMode === "auto" ? detectBrowserLanguage() : languageMode;

function translate(key) {
  return translations[currentLanguage]?.[key] || translations.de[key] || key;
}

function applyLanguage(language) {
  currentLanguage = language === "de" ? "de" : "en";
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    if (element === info && element.dataset.releaseReady === "true") return;
    element.textContent = translate(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-content]").forEach((element) => {
    element.setAttribute("content", translate(element.dataset.i18nContent));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", translate(element.dataset.i18nPlaceholder));
  });
  if (languageSelect) languageSelect.value = languageMode;
  siteMenuToggle.setAttribute("aria-label", translate(siteMenu.classList.contains("is-open") ? "common.closeMenu" : "common.openMenu"));
  if (featureCards.length) showFeatureScene(activeFeatureScene, true);
  window.xClientTranslate = translate;
  window.dispatchEvent(new CustomEvent("xclientlanguagechange", { detail: { language: currentLanguage } }));
}

function setLanguageMode(mode) {
  languageMode = mode === "de" || mode === "en" ? mode : "auto";
  try {
    if (languageMode === "auto") localStorage.removeItem(languageStorageKey);
    else localStorage.setItem(languageStorageKey, languageMode);
  } catch (_) {}
  applyLanguage(languageMode === "auto" ? detectBrowserLanguage() : languageMode);
}

const counterBaseUrl = "https://countapi.mileshilliard.com/api/v1";
const downloadCounterKey = "xlauncher-prod-a7f3-downloads";
const initialDownloadCount = 5;

function setSiteMenuOpen(open) {
  const isOpen = Boolean(open);
  siteMenu.classList.toggle("is-open", isOpen);
  siteMenu.setAttribute("aria-hidden", String(!isOpen));
  siteMenuToggle.setAttribute("aria-expanded", String(isOpen));
  siteMenuToggle.setAttribute("aria-label", translate(isOpen ? "common.closeMenu" : "common.openMenu"));
  document.body.classList.toggle("site-menu-open", isOpen);
  if (isOpen) {
    window.setTimeout(() => {
      if (siteMenu.classList.contains("is-open")) siteMenuPanel.focus();
    }, 180);
  }
}

siteMenuToggle.addEventListener("click", () => {
  setSiteMenuOpen(siteMenuToggle.getAttribute("aria-expanded") !== "true");
});

siteMenu.querySelectorAll("[data-menu-close]").forEach((element) => {
  element.addEventListener("click", () => setSiteMenuOpen(false));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && siteMenu.classList.contains("is-open")) {
    setSiteMenuOpen(false);
    siteMenuToggle.focus();
  }
});

function counterMinuteKey(date) {
  return date.toISOString().slice(0, 16).replace(/[-:t]/gi, "");
}

async function readCounter(key) {
  const response = await fetch(`${counterBaseUrl}/get/${encodeURIComponent(key)}`, { cache: "no-store" });
  if (response.status === 404) return 0;
  if (!response.ok) throw new Error(`Counter request failed (${response.status})`);
  const result = await response.json();
  return Number.isFinite(Number(result.value)) ? Number(result.value) : 0;
}

async function hitCounter(key) {
  const response = await fetch(`${counterBaseUrl}/hit/${encodeURIComponent(key)}`, {
    cache: "no-store",
    keepalive: true
  });
  if (!response.ok) throw new Error(`Counter request failed (${response.status})`);
  const result = await response.json();
  return Number.isFinite(Number(result.value)) ? Number(result.value) : 0;
}

async function updateLiveStats() {
  if (!downloadCount && !activePlayerCount) return;
  const now = new Date();
  const previousMinute = new Date(now.getTime() - 60 * 1000);
  try {
    const [trackedDownloads, currentActive, previousActive, currentClosed] = await Promise.all([
      readCounter(downloadCounterKey),
      readCounter(`xlauncher-prod-a7f3-active-${counterMinuteKey(now)}`),
      readCounter(`xlauncher-prod-a7f3-active-${counterMinuteKey(previousMinute)}`),
      readCounter(`xlauncher-prod-a7f3-closed-${counterMinuteKey(now)}`)
    ]);
    if (downloadCount) {
      downloadCount.textContent = (initialDownloadCount + trackedDownloads).toLocaleString(currentLanguage === "de" ? "de-CH" : "en-US");
    }
    const active = currentActive > 0
      ? Math.max(0, currentActive - currentClosed)
      : Math.max(0, previousActive - currentClosed);
    if (activePlayerCount) activePlayerCount.textContent = active.toLocaleString(currentLanguage === "de" ? "de-CH" : "en-US");
  } catch (_) {}
}

if (downloadCount || activePlayerCount) {
  updateLiveStats();
  window.setInterval(updateLiveStats, 5 * 1000);
}

if (primary) {
  primary.addEventListener("click", () => {
    void hitCounter(downloadCounterKey).catch(() => {});
  });
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion) {
  document.querySelectorAll(".tilt-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const box = card.getBoundingClientRect();
      const rotateX = ((event.clientY - box.top) / box.height - .5) * -9;
      const rotateY = ((event.clientX - box.left) / box.width - .5) * 9;
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });

  const wordmark = document.querySelector(".client-wordmark");
  if (wordmark) {
    wordmark.addEventListener("pointermove", (event) => {
      const box = wordmark.getBoundingClientRect();
      const x = ((event.clientX - box.left) / box.width - .5) * 10;
      const y = ((event.clientY - box.top) / box.height - .5) * -7;
      wordmark.style.transform = `perspective(900px) rotateX(${y}deg) rotateY(${x}deg) scale(1.02)`;
    });
    wordmark.addEventListener("pointerleave", () => { wordmark.style.transform = ""; });
  }
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: .14 });

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

const featureStory = document.querySelector(".feature-story");
const featureCards = [...document.querySelectorAll(".features article")];
const featureSceneKeys = [
  [
    ["home.feature1Title", "home.feature1Copy"],
    ["home.feature2Title", "home.feature2Copy"],
    ["home.feature3Title", "home.feature3Copy"]
  ],
  [
    ["home.scene2Title1", "home.scene2Copy1"],
    ["home.scene2Title2", "home.scene2Copy2"],
    ["home.scene2Title3", "home.scene2Copy3"]
  ],
  [
    ["home.scene3Title1", "home.scene3Copy1"],
    ["home.scene3Title2", "home.scene3Copy2"],
    ["home.scene3Title3", "home.scene3Copy3"]
  ]
];

let activeFeatureScene = 0;
let featureFramePending = false;

function showFeatureScene(sceneIndex, force = false) {
  if (sceneIndex === activeFeatureScene && !force) return;
  activeFeatureScene = sceneIndex;
  featureCards.forEach((card, cardIndex) => {
    const copy = card.querySelector(".feature-copy");
    const updateCopy = () => {
      const [titleKey, descriptionKey] = featureSceneKeys[sceneIndex][cardIndex];
      copy.querySelector("h2").textContent = translate(titleKey);
      copy.querySelector("p").textContent = translate(descriptionKey);
      copy.classList.remove("text-changing");
    };
    if (force || reduceMotion) updateCopy();
    else {
      copy.classList.add("text-changing");
      window.setTimeout(updateCopy, 220);
    }
  });
}

function updateFeatureStory() {
  featureFramePending = false;
  if (!featureStory || window.innerWidth <= 760) return;
  const bounds = featureStory.getBoundingClientRect();
  const scrollRange = Math.max(1, featureStory.offsetHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, -bounds.top / scrollRange));
  showFeatureScene(Math.min(featureSceneKeys.length - 1, Math.floor(progress * featureSceneKeys.length)));
}

window.addEventListener("scroll", () => {
  if (featureFramePending) return;
  featureFramePending = true;
  requestAnimationFrame(updateFeatureStory);
}, { passive: true });
updateFeatureStory();

applyLanguage(currentLanguage);
languageSelect?.addEventListener("change", () => setLanguageMode(languageSelect.value));
window.addEventListener("languagechange", () => {
  if (languageMode === "auto") applyLanguage(detectBrowserLanguage());
});

if (primary && info) {
  fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" }
  })
    .then((response) => {
      if (!response.ok) throw new Error("Release nicht verfügbar");
      return response.json();
    })
    .then((release) => {
      const installer = release.assets.find((asset) =>
        asset.name.toLowerCase().endsWith(".exe") &&
        !asset.name.toLowerCase().includes("portable")
      ) || release.assets.find((asset) => asset.name.toLowerCase().endsWith(".exe"));

      if (!installer) throw new Error("Keine EXE gefunden");
      primary.href = installer.browser_download_url;
      info.dataset.releaseReady = "true";
      info.textContent = `${release.tag_name} · ${(installer.size / 1024 / 1024).toFixed(0)} MB`;
    })
    .catch(() => {
      info.textContent = translate("downloads.github");
    });
}
