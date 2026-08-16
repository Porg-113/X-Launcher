const repo = "Porg-113/X-Launcher";
const primary = document.querySelector("#download");
const info = document.querySelector("#release-info");
const totalPlayerCount = document.querySelector("#total-player-count");
const activePlayerCount = document.querySelector("#active-player-count");
const statsStatus = document.querySelector("#stats-status");

const counterBaseUrl = "https://countapi.mileshilliard.com/api/v1/get/";

function counterMinuteKey(date) {
  return date.toISOString().slice(0, 16).replace(/[-:t]/gi, "");
}

async function readCounter(key) {
  const response = await fetch(`${counterBaseUrl}${encodeURIComponent(key)}`, { cache: "no-store" });
  if (response.status === 404) return 0;
  if (!response.ok) throw new Error(`Counter request failed (${response.status})`);
  const result = await response.json();
  return Number.isFinite(Number(result.value)) ? Number(result.value) : 0;
}

async function updateLiveStats() {
  const now = new Date();
  const previousMinute = new Date(now.getTime() - 60 * 1000);
  try {
    const [total, currentActive, previousActive] = await Promise.all([
      readCounter("xlauncher-prod-a7f3-total"),
      readCounter(`xlauncher-prod-a7f3-active-${counterMinuteKey(now)}`),
      readCounter(`xlauncher-prod-a7f3-active-${counterMinuteKey(previousMinute)}`)
    ]);
    totalPlayerCount.textContent = total.toLocaleString("de-CH");
    activePlayerCount.textContent = Math.max(currentActive, previousActive).toLocaleString("de-CH");
    statsStatus.textContent = "Anonyme Live-Daten · Aktualisierung jede Minute";
  } catch (_) {
    statsStatus.textContent = "Live-Daten gerade nicht erreichbar";
  }
}

updateLiveStats();
window.setInterval(updateLiveStats, 30 * 1000);

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
  wordmark.addEventListener("pointermove", (event) => {
    const box = wordmark.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width - .5) * 10;
    const y = ((event.clientY - box.top) / box.height - .5) * -7;
    wordmark.style.transform = `perspective(900px) rotateX(${y}deg) rotateY(${x}deg) scale(1.02)`;
  });
  wordmark.addEventListener("pointerleave", () => { wordmark.style.transform = ""; });
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
const featureScenes = [
  [
    ["Modrinth integriert", "Suche und installiere Mods, Modpacks, Shader sowie Ressourcenpakete direkt im Launcher – passend zu deiner Fabric-Version."],
    ["Profile und Skins", "Erstelle Profile mit getrennten Mods-Ordnern. Importiere eigene Skins und sieh sie direkt in der Vorschau an."],
    ["Server und Updates", "Speichere Server-Favoriten und starte sie direkt. Installierte Launcher-Versionen suchen automatisch nach neuen Updates."]
  ],
  [
    ["Microsoft-Anmeldung", "Melde dich über Microsoft und Xbox an oder verwende den Offline-Modus. Danach kannst du Minecraft direkt starten."],
    ["Fabric-Versionen", "Wähle und verwalte unterschiedliche Minecraft-Versionen mit Fabric Mod Loader direkt in deinen Profilen."],
    ["Mods automatisch anpassen", "Der Launcher erkennt verwaltete Mods und kann sie gemeinsam auf eine ausgewählte Minecraft-Version abstimmen."]
  ],
  [
    ["Alles übersichtlich", "Mods, Shader und Ressourcenpakete erscheinen in getrennten Ansichten und lassen sich mit wenigen Klicks verwalten."],
    ["Dein eigener Look", "Importiere einen Minecraft-Skin und kontrolliere ihn direkt in der integrierten dreidimensionalen Vorschau."],
    ["Automatisch aktuell", "Die installierte Windows-Version prüft GitHub Releases auf Updates und installiert sie nach einem Neustart."]
  ]
];

let activeFeatureScene = 0;
let featureFramePending = false;

function showFeatureScene(sceneIndex) {
  if (sceneIndex === activeFeatureScene) return;
  activeFeatureScene = sceneIndex;
  featureCards.forEach((card, cardIndex) => {
    const copy = card.querySelector(".feature-copy");
    copy.classList.add("text-changing");
    window.setTimeout(() => {
      const [title, description] = featureScenes[sceneIndex][cardIndex];
      copy.querySelector("h2").textContent = title;
      copy.querySelector("p").textContent = description;
      copy.classList.remove("text-changing");
    }, reduceMotion ? 0 : 220);
  });
}

function updateFeatureStory() {
  featureFramePending = false;
  if (!featureStory || window.innerWidth <= 760) return;
  const bounds = featureStory.getBoundingClientRect();
  const scrollRange = Math.max(1, featureStory.offsetHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, -bounds.top / scrollRange));
  showFeatureScene(Math.min(featureScenes.length - 1, Math.floor(progress * featureScenes.length)));
}

window.addEventListener("scroll", () => {
  if (featureFramePending) return;
  featureFramePending = true;
  requestAnimationFrame(updateFeatureStory);
}, { passive: true });
updateFeatureStory();

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
    info.textContent = `${release.tag_name} · ${(installer.size / 1024 / 1024).toFixed(0)} MB`;
  })
  .catch(() => {
    info.textContent = "Neueste Version auf GitHub ansehen";
  });
