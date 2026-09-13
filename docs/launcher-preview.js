(() => {
  const previewBody = document.body;
  const deployedAssetVersion = new URLSearchParams(window.location.search).get("v");
  const skinUrl = new URL(previewBody?.dataset.launcherSkinSrc || "assets/skins/i-am-steve.png", document.baseURI);
  if (deployedAssetVersion) skinUrl.searchParams.set("v", deployedAssetVersion);
  const SKIN_URL = skinUrl.href;
  const xClientIconUrl = new URL("x-logo.png", document.baseURI);
  if (deployedAssetVersion) xClientIconUrl.searchParams.set("v", deployedAssetVersion);
  const X_CLIENT_ICON_URL = xClientIconUrl.href;
  const LAUNCHER_STANDARD_PROFILE = Object.freeze({
    name: "Launcher-Standard",
    minecraftVersion: "26.2",
    loader: "Fabric"
  });
  // Keep this list aligned with DEFAULT_PACK_PROJECTS and REQUIRED_BUNDLED_MODS
  // in src/main.parts/part-01.jsfrag. A public website cannot read a visitor's
  // local launcher data, so this is the exact equipped default state shown by
  // a fresh X Client installation.
  const LAUNCHER_STANDARD_MODS = Object.freeze([
    { id: "x-launcher-menu", name: "X Client", kind: "Pflichtmod", hidden: true, iconUrl: X_CLIENT_ICON_URL },
    { id: "fabric-api", name: "Fabric API", kind: "System-Mod", hidden: true, iconUrl: "https://cdn.modrinth.com/data/P7dR8mSH/icon.png" },
    { id: "silicons", name: "Silicon", kind: "Performance", hidden: true, iconUrl: "https://cdn.modrinth.com/data/MdNZOBlg/b7e1e985a0fc8bb0164b025a310c3e843b4a5211_96.webp" },
    { id: "sodium", name: "Sodium", kind: "Performance", hidden: true, iconUrl: "https://cdn.modrinth.com/data/AANobbMI/295862f4724dc3f78df3447ad6072b2dcd3ef0c9_96.webp" },
    { id: "iris", name: "Iris Shaders", kind: "Shader-Engine", hidden: true, iconUrl: "https://cdn.modrinth.com/data/YL57xq9U/18d0e7f076d3d6ed5bedd472b853909aac5da202_96.webp" },
    { id: "modmenu", name: "Mod Menu", kind: "Standard-Mod", hidden: true, iconUrl: "https://cdn.modrinth.com/data/mOgUt4GM/5a20ed1450a0e1e79a1fe04e61bb4e5878bf1d20.png" },
    { id: "infinite-zoom", name: "Infinite Zoom", kind: "System-Mod", hidden: true, iconUrl: "https://cdn.modrinth.com/data/pS3Sez5p/d655cc00c40d4b9214214920971daf7a6ec4b8b0.png" },
    { id: "simple-voice-chat", name: "Simple Voice Chat", kind: "Standard-Mod", hidden: true, iconUrl: "https://cdn.modrinth.com/data/9eGKb6K1/icon.png" },
    { id: "lithium", name: "Lithium", kind: "Performance", hidden: true, iconUrl: "https://cdn.modrinth.com/data/gvQqBUqZ/bcc8686c13af0143adf4285d741256af824f70b7_96.webp" },
    { id: "ferrite-core", name: "FerriteCore", kind: "Performance", hidden: true, iconUrl: "https://cdn.modrinth.com/data/uXXizFIs/222a126f26f8f9ae1eb339f3b767677f18bff31f_96.webp" },
    { id: "entityculling", name: "Entity Culling", kind: "Performance", hidden: true, iconUrl: "https://cdn.modrinth.com/data/NNAgCjsB/7873452d6cede4daed12da3d7d8c193ab88b4fd6_96.webp" },
    { id: "immediatelyfast", name: "ImmediatelyFast", kind: "Performance", hidden: true, iconUrl: "https://cdn.modrinth.com/data/5ZwdcRci/e57b6b451425692ac17ad322d5e14bea686a383a_96.webp" },
    { id: "moreculling", name: "More Culling", kind: "Performance", hidden: true, iconUrl: "https://cdn.modrinth.com/data/51shyZVL/c51b07193b56e952269ef50101d12aecba2b4747_96.webp" },
    { id: "dynamic-fps", name: "Dynamic FPS", kind: "Performance", hidden: true, iconUrl: "https://cdn.modrinth.com/data/LQ3K71Q1/5056368d0d87c1a9f3efead0cb48ab39a4ea87bf_96.webp" },
    { id: "clumps", name: "Clumps", kind: "Performance", hidden: true, iconUrl: "https://cdn.modrinth.com/data/Wnxd13zP/6a965bb7974c3e759a53a1c89c35de4acd4cf86a_96.webp" },
    { id: "fast-ip-ping", name: "Fast IP Ping", kind: "Performance", hidden: true, iconUrl: "https://cdn.modrinth.com/data/9mtu0sUO/dca186a8a57d45ad06e88de6cfc45d4cc4c6a0ba.png" },
    { id: "particle-core", name: "Particle Core", kind: "Performance", hidden: true, iconUrl: "https://cdn.modrinth.com/data/RSeLon5O/147110a6a4457b2f287f68fc626771f0f8ef2cde_96.webp" },
    { id: "c2me-fabric", name: "Concurrent Chunk Management Engine", kind: "Performance", hidden: true, iconUrl: "https://cdn.modrinth.com/data/VSNURh3q/3c2ce471054466712a44c8758a03e03bb868f93b_96.webp" },
    { id: "appleskin", name: "AppleSkin", kind: "Standard-Mod", hidden: true, iconUrl: "https://cdn.modrinth.com/data/EsAfCjCV/icon.png" },
    { id: "continuity", name: "Continuity", kind: "Performance", hidden: true, iconUrl: "https://cdn.modrinth.com/data/1IjD5062/icon.png" },
    { id: "chat-heads", name: "Chat Heads", kind: "Standard-Mod", hidden: true, iconUrl: "https://cdn.modrinth.com/data/Wb5oqrBJ/icon.png" },
    { id: "controlling", name: "Controlling", kind: "Standard-Mod", hidden: true, iconUrl: "https://cdn.modrinth.com/data/xv94TkTM/bdb6feb3d04ca37da4ed5aa73fef062a39d8b3e5_96.webp" },
    { id: "shulkerboxtooltip", name: "Shulker Box Tooltip", kind: "Standard-Mod", hidden: true, iconUrl: "https://cdn.modrinth.com/data/2M01OLQq/bb490716cf2590cf84100a495931c3d4743bce43_96.webp" }
  ]);
  const LAUNCHER_VISIBLE_MODS = Object.freeze([
    { id: "xaeros-minimap", name: "Xaero's Minimap", kind: "Community-Mod", iconUrl: "https://cdn.modrinth.com/data/1bokaNcj/354080f65407e49f486fcf9c4580e82c45ae63b8_96.webp" },
    { id: "emi", name: "EMI", kind: "Community-Mod", iconUrl: "https://cdn.modrinth.com/data/fRiHVvU7/395fe5302b2bab612ef0623509f768f3c5a5ee0f.webp" },
    { id: "wthit", name: "WTHIT", kind: "Community-Mod", iconUrl: "https://cdn.modrinth.com/data/6AQIaxuO/2bd96dccf28d264598c2c5f5a46c1d57561841a2_96.webp" },
    { id: "lamb-dynamic-lights", name: "LambDynamicLights", kind: "Community-Mod", iconUrl: "https://cdn.modrinth.com/data/yBW8D80W/d4f5c3ff8df7caf024178b04eca6d69f95979cfe_96.webp" },
    { id: "not-enough-animations", name: "Not Enough Animations", kind: "Community-Mod", iconUrl: "https://cdn.modrinth.com/data/MPCX6s5C/b97fd5f7a893165052408b747286d6eb38d57abb_96.webp" },
    { id: "presence-footsteps", name: "Presence Footsteps", kind: "Community-Mod", iconUrl: "https://cdn.modrinth.com/data/rcTfTZr3/c08dc581f0bf3b729f86e962fa800463af86e9a2_96.webp" },
    { id: "inventory-profiles-next", name: "Inventory Profiles Next", kind: "Community-Mod", iconUrl: "https://cdn.modrinth.com/data/O7RBXm3n/04cdecd37b4c7409f70d36fcdc85722ebf14aab8_96.webp" }
  ]);
  const LAUNCHER_STANDARD_CONTENT = Object.freeze([
    { id: "complementary-reimagined", name: "Complementary Shaders - Reimagined", itemType: "shader", kind: "Shader", iconUrl: "https://cdn.modrinth.com/data/HVnmMxH1/79cb7c8123bbc54945305b2ebad6b8881efdf5f8_96.webp" },
    { id: "bsl-shaders", name: "BSL Shaders", itemType: "shader", kind: "Shader", iconUrl: "https://cdn.modrinth.com/data/Q1vvjJYV/2a611a3cb434fb52fb81fa5dace13c5d8b67e55d_96.webp" },
    { id: "fresh-animations", name: "Fresh Animations", itemType: "resourcepack", kind: "Ressourcenpaket", iconUrl: "https://cdn.modrinth.com/data/50dA9Sha/3132c10e9e3c73fde9799720fd3da5561071708c_96.webp" },
    { id: "better-vanilla-building", name: "BetterVanillaBuilding", itemType: "resourcepack", kind: "Ressourcenpaket", iconUrl: "https://cdn.modrinth.com/data/LBcosBrl/icon.png" }
  ]);
  const toast = document.querySelector("#preview-toast");
  const sections = [...document.querySelectorAll(".content-section")];
  const navButtons = [...document.querySelectorAll(".nav-item[data-section]")];
  const skinTextureCache = new Map();
  let toastTimer = 0;
  let dashboardAnimationFrame = 0;

  function showToast(message) {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2300);
  }

  function showSection(sectionName) {
    sections.forEach((section) => section.classList.toggle("active", section.id === sectionName));
    navButtons.forEach((button) => button.classList.toggle("active", button.dataset.section === sectionName));
    document.querySelector(`#${CSS.escape(sectionName)}`)?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderLauncherStandardProfile() {
    const totalMods = LAUNCHER_STANDARD_MODS.length + LAUNCHER_VISIBLE_MODS.length;
    const profileLabel = `${LAUNCHER_STANDARD_PROFILE.name} · Minecraft ${LAUNCHER_STANDARD_PROFILE.minecraftVersion} · ${LAUNCHER_STANDARD_PROFILE.loader}`;
    const startProfileSelect = document.querySelector("#start-pack-select");
    const profileList = document.querySelector("#packs-list");
    const profileStatus = document.querySelector("#packs-status");

    if (startProfileSelect) {
      startProfileSelect.replaceChildren(new Option(profileLabel, "", true, true));
      startProfileSelect.disabled = true;
    }
    if (profileStatus) profileStatus.textContent = `${LAUNCHER_STANDARD_PROFILE.name} ist aktiv · ${totalMods} Standard-Mods ausgerüstet.`;
    if (!profileList) return;

    profileList.innerHTML = `
      <article class="pack-card active" data-preview-profile="launcher-standard">
        <div class="pack-card-head">
          <div>
            <h4>${LAUNCHER_STANDARD_PROFILE.name}</h4>
            <p>Der offizielle .minecraft-Mods-Ordner mit allen Standard-Mods von X Client.</p>
          </div>
          <span class="pack-badge">AKTIV</span>
        </div>
        <div class="pack-meta">
          <span class="pack-tag">${LAUNCHER_STANDARD_PROFILE.loader} ${LAUNCHER_STANDARD_PROFILE.minecraftVersion}</span>
          <span class="pack-tag">${totalMods} Standard-Mods ausgerüstet</span>
        </div>
        <div class="pack-actions"><button class="btn btn-secondary" type="button" disabled>Aktives Profil</button></div>
      </article>
    `;
  }

  function renderLauncherStandardMods(view = "mod") {
    const modList = document.querySelector("#mods-list");
    const contextLabel = document.querySelector("#mods-context-label");
    const sectionTitle = document.querySelector("#mods-section-title");
    if (!modList) return;

    if (contextLabel) contextLabel.textContent = `${LAUNCHER_STANDARD_PROFILE.name} · ${LAUNCHER_STANDARD_MODS.length} Standard-Mods ausgerüstet.`;
    if (sectionTitle) sectionTitle.textContent = "Standard-Mods für diese Version";
    if (view !== "mod") {
      modList.innerHTML = `<p class="mods-empty">Keine ${view === "hidden" ? "ausgeblendeten Inhalte" : "Standard-Inhalte"} im ${LAUNCHER_STANDARD_PROFILE.name}.</p>`;
      return;
    }

    modList.innerHTML = LAUNCHER_STANDARD_MODS.map((mod) => `
      <article class="mod-item installed-mod-card" data-standard-mod="${mod.id}">
        <div class="mod-head">
          <div class="mod-title-wrap">
            <div class="mod-icon mod-icon-placeholder" aria-hidden="true">${mod.name.slice(0, 1)}</div>
            <div class="installed-mod-copy">
              <div class="installed-mod-name-row"><div class="installed-mod-name-text"><h4>${mod.name}</h4></div></div>
              <span class="mod-source-badge">${mod.kind}</span>
            </div>
          </div>
        </div>
        <p>Im ${LAUNCHER_STANDARD_PROFILE.name} aktiviert.</p>
        <div class="mod-tags"><span class="mod-tag">Fabric ${LAUNCHER_STANDARD_PROFILE.minecraftVersion}</span><span class="mod-tag">Ausgerüstet</span></div>
        <div class="mod-actions"><button class="btn btn-secondary" type="button" disabled>Ausgerüstet</button></div>
      </article>
    `).join("");
  }

  function getLauncherPreviewView(view) {
    if (view === "hidden") {
      return { title: "Ausgeblendete Pflichtmods", dropTitle: "Ausgeblendete Mods", dropHint: "Pflicht- und Performance-Mods", items: LAUNCHER_STANDARD_MODS.filter((mod) => mod.hidden), empty: "Keine ausgeblendeten Mods installiert." };
    }
    if (view === "shader") {
      return { title: "Shader", dropTitle: "Shader über Modrinth installieren", dropHint: "ZIP-Dateien werden im shaderpacks-Ordner verwaltet.", items: LAUNCHER_STANDARD_CONTENT.filter((item) => item.itemType === "shader"), empty: "Keine Shader installiert." };
    }
    if (view === "resourcepack") {
      return { title: "Ressourcenpakete", dropTitle: "Ressourcenpakete über Modrinth installieren", dropHint: "ZIP-Dateien werden im resourcepacks-Ordner verwaltet.", items: LAUNCHER_STANDARD_CONTENT.filter((item) => item.itemType === "resourcepack"), empty: "Keine Ressourcenpakete installiert." };
    }
    return { title: "Mods für diese Version", dropTitle: "Mods hier ablegen", dropHint: "JAR-Dateien", items: LAUNCHER_VISIBLE_MODS, empty: "Keine Mods für diese Version aktiv." };
  }

  function renderLauncherStandardContent(view = "mod") {
    const modList = document.querySelector("#mods-list");
    const contextLabel = document.querySelector("#mods-context-label");
    const sectionTitle = document.querySelector("#mods-section-title");
    const dropZone = document.querySelector("#mods-drop-zone");
    if (!modList) return;

    const config = getLauncherPreviewView(view);
    if (contextLabel) contextLabel.textContent = `${LAUNCHER_STANDARD_PROFILE.name} · ${LAUNCHER_STANDARD_MODS.length + LAUNCHER_VISIBLE_MODS.length} Mods, ${LAUNCHER_STANDARD_CONTENT.length} Inhalte ausgerüstet.`;
    if (sectionTitle) sectionTitle.textContent = config.title;
    if (dropZone) {
      dropZone.querySelector("strong").textContent = config.dropTitle;
      dropZone.querySelector("span").textContent = config.dropHint;
      dropZone.classList.toggle("is-download-only", view !== "mod");
    }
    if (!config.items.length) {
      modList.innerHTML = `<p class="mods-empty">${config.empty}</p>`;
      return;
    }

    modList.innerHTML = config.items.map((item) => {
      const isHidden = view === "hidden";
      const itemType = item.itemType || "mod";
      const badge = isHidden ? `Ausgeblendet · ${item.kind}` : `${item.kind} · Aktiv`;
      return `
        <article class="mod-item installed-mod-card${isHidden ? " is-preview-hidden" : ""}" data-standard-mod="${item.id}" data-preview-content-type="${itemType}">
          <div class="mod-head">
            <div class="mod-title-wrap">
              <img class="mod-icon" src="${item.iconUrl}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/icons/nav-modrinth.svg'">
              <div class="installed-mod-copy">
                <div class="installed-mod-name-row"><div class="installed-mod-name-text"><h4>${item.name}</h4></div></div>
                <span class="mod-source-badge">${badge}</span>
              </div>
            </div>
          </div>
          <p>Im ${LAUNCHER_STANDARD_PROFILE.name} ausgerüstet.</p>
        </article>
      `;
    }).join("");
  }

  function applyLauncherSkinState() {
    const skinName = previewBody?.dataset.launcherSkinName || "Steve";
    const skinVariant = previewBody?.dataset.launcherSkinVariant || "wide";
    const skinImage = `url("${SKIN_URL}")`;
    const headerSkin = document.querySelector("#header-skin-head");
    const savedSkin = document.querySelector(".saved-skin-chip");
    const savedSkinName = document.querySelector(".saved-skin-chip-content h5");
    const skinStatus = document.querySelector("#skin-status");
    const skinCanvas = document.querySelector("#skin-preview-canvas");

    headerSkin?.style.setProperty("--skin-image", skinImage);
    headerSkin?.setAttribute("aria-label", `Aktiver Skin ${skinName}`);
    savedSkin?.setAttribute("data-skin-name", skinName);
    if (savedSkinName) savedSkinName.textContent = skinName;
    if (skinStatus) skinStatus.textContent = `Aktiver Skin: ${skinName} · 1 gespeichert`;
    skinCanvas?.setAttribute("aria-label", `Skin ${skinName}`);

    return { id: "launcher-default-skin", name: skinName, previewDataUrl: SKIN_URL, height: 64, variant: skinVariant };
  }

  renderLauncherStandardProfile();
  renderLauncherStandardContent();

  navButtons.forEach((button) => {
    button.dataset.previewWired = "true";
    button.addEventListener("click", () => showSection(button.dataset.section));
  });

  const accountButton = document.querySelector("#username-display");
  if (accountButton) {
    accountButton.dataset.previewWired = "true";
    accountButton.addEventListener("click", () => showSection("accounts"));
  }

  const requestedSection = new URLSearchParams(window.location.search).get("section");
  if (requestedSection && sections.some((section) => section.id === requestedSection)) {
    showSection(requestedSection);
  }

  document.querySelectorAll("[data-mods-view], [data-modrinth-type], [data-cape-face]").forEach((button) => {
    button.dataset.previewWired = "true";
    button.addEventListener("click", () => {
      const selector = button.hasAttribute("data-mods-view")
        ? "[data-mods-view]"
        : button.hasAttribute("data-modrinth-type")
          ? "[data-modrinth-type]"
          : "[data-cape-face]";
      button.closest("nav, .modrinth-type-tabs, .cape-face-tabs")?.querySelectorAll(selector).forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      if (button.hasAttribute("data-mods-view")) renderLauncherStandardContent(button.dataset.modsView);
    });
  });

  document.querySelectorAll('.settings-overview a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      document.querySelector(link.getAttribute("href"))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  const appearanceToggle = document.querySelector("#appearance-mode-toggle");
  appearanceToggle?.addEventListener("change", () => {
    document.documentElement.classList.toggle("theme-light", appearanceToggle.checked);
    const status = document.querySelector("#appearance-mode-status");
    if (status) status.textContent = appearanceToggle.checked ? "Hellmodus aktiv" : "Dunkelmodus aktiv";
  });

  const colorInputs = {
    red: document.querySelector("#red-slider"),
    green: document.querySelector("#green-slider"),
    blue: document.querySelector("#blue-slider")
  };
  function updateAccent() {
    const red = Number(colorInputs.red?.value || 0);
    const green = Number(colorInputs.green?.value || 217);
    const blue = Number(colorInputs.blue?.value || 255);
    document.documentElement.style.setProperty("--primary-color", `rgb(${red}, ${green}, ${blue})`);
    document.documentElement.style.setProperty("--primary-rgb", `${red}, ${green}, ${blue}`);
    const preview = document.querySelector("#color-preview");
    if (preview) preview.style.background = `rgb(${red}, ${green}, ${blue})`;
    [["red-value", red], ["green-value", green], ["blue-value", blue]].forEach(([id, value]) => {
      const output = document.getElementById(id);
      if (output) output.textContent = String(value);
    });
  }
  Object.values(colorInputs).forEach((input) => input?.addEventListener("input", updateAccent));
  updateAccent();

  document.querySelector("#skin-color-sync-toggle")?.addEventListener("change", (event) => {
    if (!event.currentTarget.checked) return;
    if (colorInputs.red) colorInputs.red.value = "0";
    if (colorInputs.green) colorInputs.green.value = "217";
    if (colorInputs.blue) colorInputs.blue.value = "255";
    updateAccent();
  });

  document.querySelectorAll('input[type="range"]').forEach((input) => {
    input.addEventListener("input", () => {
      const output = document.querySelector(`#${CSS.escape(input.id.replace("slider", "value"))}`);
      if (output && !/red|green|blue/u.test(input.id)) {
        output.textContent = input.id.includes("volume") ? `${input.value}%` : input.value;
      }
    });
  });

  function restrictedMessage(button) {
    const label = `${button.id} ${button.dataset.launcherAction || ""} ${button.textContent}`.toLowerCase();
    if (/launch|play|start|join|beitreten/u.test(label)) return "In der Vorschau wird Minecraft nicht gestartet.";
    if (/install|update|aktual|check|prüf/u.test(label)) return "In der Vorschau wird nichts installiert oder aktualisiert.";
    if (/delete|remove|clear|cleanup|lösch|entfern|unequip/u.test(label)) return "In der Vorschau wird nichts gelöscht.";
    if (/create|add|import|export|choose|folder|path|speicher|erstell|hinzuf|ordner|skin|cape/u.test(label)) return "In der Vorschau werden keine Dateien erstellt, importiert oder exportiert.";
    if (/logout|abmelden/u.test(label)) return "Das Demo-Konto X Client bleibt angemeldet.";
    return "Diese Aktion verändert in der Vorschau nichts auf deinem PC.";
  }

  function isRestricted(button) {
    const label = `${button.id} ${button.dataset.launcherAction || ""} ${button.textContent}`.toLowerCase();
    return /launch|play|start|join|beitreten|install|update|aktual|check|prüf|delete|remove|clear|cleanup|lösch|entfern|unequip|create|add|import|export|choose|folder|path|speicher|erstell|hinzuf|ordner|skin|cape/u.test(label);
  }

  document.querySelectorAll("button:not([data-preview-wired])").forEach((button) => {
    if (!isRestricted(button)) return;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showToast(restrictedMessage(button));
    });
  });

  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", (event) => event.preventDefault());
  });
  document.querySelectorAll('input[type="file"]').forEach((input) => { input.disabled = true; });
  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => event.preventDefault());

  function loadImageSource(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Skin-Vorschau konnte nicht geladen werden."));
      image.src = source;
    });
  }

  async function loadSkinTexture(source) {
    if (skinTextureCache.has(source)) return skinTextureCache.get(source);
    const image = await loadImageSource(source);
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = image.naturalWidth || image.width;
    sourceCanvas.height = image.naturalHeight || image.height;
    const sourceContext = sourceCanvas.getContext("2d");
    if (!sourceContext) return null;
    sourceContext.imageSmoothingEnabled = false;
    sourceContext.drawImage(image, 0, 0);
    const texture = { sourceCanvas, sourceContext };
    skinTextureCache.set(source, texture);
    return texture;
  }

  // This is the same pixel-projected renderer used by the desktop X Client.
  async function renderSkin3DPreviewCanvas(canvas, activeSkin, scale = 10, animationTime = 0) {
    if (!canvas) return false;
    const context = canvas.getContext("2d");
    if (!context) return false;
    if (!activeSkin?.previewDataUrl) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.classList.add("hidden");
      return false;
    }

    const texture = await loadSkinTexture(activeSkin.previewDataUrl);
    if (!texture) return false;
    const { sourceContext } = texture;
    const isLegacy = activeSkin.height === 32;
    const isSlim = activeSkin.variant === "slim" && !isLegacy;
    const armWidth = isSlim ? 3 : 4;
    const depth = { x: Math.round(scale * 0.62), y: -Math.round(scale * 0.42) };
    const modelLeft = 3.55;
    const modelRight = 12.45 + (armWidth * 2);
    const modelWidth = modelRight - modelLeft;
    const legDrop = 0.5;
    const modelHeight = 32 + Math.max(legDrop, 0);
    const padding = scale * 5;
    const animationPadding = scale * 1.7;
    const stageWidth = Math.ceil((modelWidth * scale) + depth.x + (padding * 2) + (animationPadding * 2));
    const stageHeight = Math.ceil((modelHeight * scale) - depth.y + (padding * 2) + (animationPadding * 2));

    canvas.width = stageWidth;
    canvas.height = stageHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false;

    const originX = ((stageWidth - (modelWidth * scale) - depth.x) / 2) - (modelLeft * scale);
    const originY = ((stageHeight - (modelHeight * scale) + depth.y) / 2) - depth.y;
    const sway = Math.sin(animationTime / 720) * 0.26;
    const smallSway = Math.sin((animationTime / 720) + Math.PI) * 0.18;
    const pose = {
      bodyRotation: 0,
      headRotation: -2,
      leftArmRotation: -5,
      rightArmRotation: 6,
      leftLegRotation: 2,
      rightLegRotation: -2,
      leftArmX: 3.85,
      leftArmY: 8.15,
      rightArmX: 12.15 + armWidth,
      rightArmY: 8.2,
      leftLegX: 4 + armWidth,
      leftLegY: 20 + legDrop,
      rightLegX: 8 + armWidth,
      rightLegY: 20 + legDrop
    };

    const rgbaCache = new Map();
    const getPixel = (sourceX, sourceY) => {
      const key = `${sourceX},${sourceY}`;
      if (rgbaCache.has(key)) return rgbaCache.get(key);
      const pixel = sourceContext.getImageData(sourceX, sourceY, 1, 1).data;
      const value = { r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] / 255 };
      rgbaCache.set(key, value);
      return value;
    };
    const getColor = (sourceX, sourceY, shade) => {
      const pixel = getPixel(sourceX, sourceY);
      if (pixel.a <= 0) return null;
      const clampColor = (value) => Math.max(0, Math.min(255, Math.round(value * shade)));
      return `rgba(${clampColor(pixel.r)}, ${clampColor(pixel.g)}, ${clampColor(pixel.b)}, ${pixel.a})`;
    };
    const project = (face, xRatio, yRatio) => ({
      x: face.topLeft.x + ((face.topRight.x - face.topLeft.x) * xRatio) + ((face.bottomLeft.x - face.topLeft.x) * yRatio),
      y: face.topLeft.y + ((face.topRight.y - face.topLeft.y) * xRatio) + ((face.bottomLeft.y - face.topLeft.y) * yRatio)
    });
    const drawQuad = (points, color) => {
      const center = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
      center.x /= points.length;
      center.y /= points.length;
      const expandedPoints = points.map((point) => {
        const deltaX = point.x - center.x;
        const deltaY = point.y - center.y;
        const length = Math.hypot(deltaX, deltaY) || 1;
        return { x: point.x + ((deltaX / length) * 0.45), y: point.y + ((deltaY / length) * 0.45) };
      });
      context.beginPath();
      context.moveTo(expandedPoints[0].x, expandedPoints[0].y);
      expandedPoints.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.closePath();
      context.fillStyle = color;
      context.fill();
    };
    const drawTexturedFace = (source, face, shade) => {
      if (!source) return;
      for (let y = 0; y < source.h; y += 1) {
        for (let x = 0; x < source.w; x += 1) {
          const color = getColor(source.x + x, source.y + y, shade);
          if (!color) continue;
          const topLeft = project(face, x / source.w, y / source.h);
          const topRight = project(face, (x + 1) / source.w, y / source.h);
          const bottomRight = project(face, (x + 1) / source.w, (y + 1) / source.h);
          const bottomLeft = project(face, x / source.w, (y + 1) / source.h);
          drawQuad([topLeft, topRight, bottomRight, bottomLeft], color);
        }
      }
    };
    const makeFace = (x, y, width, height, inflate = 0, rotation = 0, pivot = null) => {
      const radians = (rotation * Math.PI) / 180;
      const cosine = Math.cos(radians);
      const sine = Math.sin(radians);
      const inflatedX = x - inflate;
      const inflatedY = y - inflate;
      const inflatedWidth = width + (inflate * 2);
      const inflatedHeight = height + (inflate * 2);
      const pivotX = pivot?.x ?? (inflatedX + (inflatedWidth / 2));
      const pivotY = pivot?.y ?? (inflatedY + (inflatedHeight / 2));
      const makePoint = (pointX, pointY) => {
        const localX = pointX - pivotX;
        const localY = pointY - pivotY;
        return {
          x: originX + ((pivotX + ((localX * cosine) - (localY * sine))) * scale),
          y: originY + ((pivotY + ((localX * sine) + (localY * cosine))) * scale)
        };
      };
      const topLeft = makePoint(inflatedX, inflatedY);
      const topRight = makePoint(inflatedX + inflatedWidth, inflatedY);
      const bottomRight = makePoint(inflatedX + inflatedWidth, inflatedY + inflatedHeight);
      const bottomLeft = makePoint(inflatedX, inflatedY + inflatedHeight);
      return {
        front: { topLeft, topRight, bottomLeft },
        right: { topLeft: topRight, topRight: { x: topRight.x + depth.x, y: topRight.y + depth.y }, bottomLeft: bottomRight },
        top: { topLeft, topRight, bottomLeft: { x: topLeft.x + depth.x, y: topLeft.y + depth.y } }
      };
    };
    const drawBox = ({ x, y, w, h, rotation = 0, pivot = null, front, right, top, overlayFront, overlayRight, overlayTop }) => {
      const faces = makeFace(x, y, w, h, 0, rotation, pivot);
      drawTexturedFace(top, faces.top, 1.08);
      drawTexturedFace(right, faces.right, 0.72);
      drawTexturedFace(front, faces.front, 1);
      const overlayFaces = makeFace(x, y, w, h, 0.34, rotation, pivot);
      drawTexturedFace(overlayTop, overlayFaces.top, 1.08);
      drawTexturedFace(overlayRight, overlayFaces.right, 0.72);
      drawTexturedFace(overlayFront, overlayFaces.front, 1);
    };

    const rightArmSourceY = isLegacy ? 20 : 52;
    const rightArmTopY = isLegacy ? 16 : 48;
    const rightLegSourceX = isLegacy ? 4 : 20;
    const rightLegTopX = isLegacy ? 4 : 20;
    const rightLegSourceY = isLegacy ? 20 : 52;
    const rightLegTopY = isLegacy ? 16 : 48;

    drawBox({
      x: pose.leftArmX, y: pose.leftArmY + sway, w: armWidth, h: 12,
      rotation: pose.leftArmRotation, pivot: { x: pose.leftArmX + armWidth, y: 8.9 },
      front: { x: 44, y: 20, w: armWidth, h: 12 }, right: { x: 40, y: 20, w: 4, h: 12 }, top: { x: 44, y: 16, w: armWidth, h: 4 },
      overlayFront: isLegacy ? null : { x: 44, y: 36, w: armWidth, h: 12 }, overlayRight: isLegacy ? null : { x: 40, y: 36, w: 4, h: 12 }, overlayTop: isLegacy ? null : { x: 44, y: 32, w: armWidth, h: 4 }
    });
    drawBox({
      x: 4 + armWidth, y: 8, w: 8, h: 12, rotation: pose.bodyRotation,
      front: { x: 20, y: 20, w: 8, h: 12 }, right: { x: 16, y: 20, w: 4, h: 12 }, top: { x: 20, y: 16, w: 8, h: 4 },
      overlayFront: isLegacy ? null : { x: 20, y: 36, w: 8, h: 12 }, overlayRight: isLegacy ? null : { x: 16, y: 36, w: 4, h: 12 }, overlayTop: isLegacy ? null : { x: 20, y: 32, w: 8, h: 4 }
    });
    drawBox({
      x: pose.rightArmX, y: pose.rightArmY - sway, w: armWidth, h: 12,
      rotation: pose.rightArmRotation, pivot: { x: pose.rightArmX, y: 8.9 },
      front: { x: 36, y: rightArmSourceY, w: armWidth, h: 12 }, right: { x: 32, y: rightArmSourceY, w: 4, h: 12 }, top: { x: 36, y: rightArmTopY, w: armWidth, h: 4 },
      overlayFront: isLegacy ? null : { x: 52, y: 52, w: armWidth, h: 12 }, overlayRight: isLegacy ? null : { x: 48, y: 52, w: 4, h: 12 }, overlayTop: isLegacy ? null : { x: 52, y: 48, w: armWidth, h: 4 }
    });
    drawBox({
      x: pose.leftLegX, y: pose.leftLegY + smallSway, w: 4, h: 12,
      rotation: pose.leftLegRotation, pivot: { x: pose.leftLegX + 2, y: pose.leftLegY },
      front: { x: 4, y: 20, w: 4, h: 12 }, right: { x: 0, y: 20, w: 4, h: 12 }, top: { x: 4, y: 16, w: 4, h: 4 },
      overlayFront: isLegacy ? null : { x: 4, y: 36, w: 4, h: 12 }, overlayRight: isLegacy ? null : { x: 0, y: 36, w: 4, h: 12 }, overlayTop: isLegacy ? null : { x: 4, y: 32, w: 4, h: 4 }
    });
    drawBox({
      x: pose.rightLegX, y: pose.rightLegY - smallSway, w: 4, h: 12,
      rotation: pose.rightLegRotation, pivot: { x: pose.rightLegX + 2, y: pose.rightLegY },
      front: { x: rightLegSourceX, y: rightLegSourceY, w: 4, h: 12 }, right: { x: rightLegSourceX - 4, y: rightLegSourceY, w: 4, h: 12 }, top: { x: rightLegTopX, y: rightLegTopY, w: 4, h: 4 },
      overlayFront: isLegacy ? null : { x: 4, y: 52, w: 4, h: 12 }, overlayRight: isLegacy ? null : { x: 0, y: 52, w: 4, h: 12 }, overlayTop: isLegacy ? null : { x: 4, y: 48, w: 4, h: 4 }
    });
    drawBox({
      x: 4 + armWidth, y: 0, w: 8, h: 8, rotation: pose.headRotation, pivot: { x: 8 + armWidth, y: 8 },
      front: { x: 8, y: 8, w: 8, h: 8 }, right: { x: 16, y: 8, w: 8, h: 8 }, top: { x: 8, y: 0, w: 8, h: 8 },
      overlayFront: { x: 40, y: 8, w: 8, h: 8 }, overlayRight: { x: 48, y: 8, w: 8, h: 8 }, overlayTop: { x: 40, y: 0, w: 8, h: 8 }
    });

    canvas.classList.remove("hidden");
    canvas.setAttribute("aria-hidden", "false");
    return true;
  }

  async function drawSkinHead(canvas) {
    if (!canvas) return;
    const image = new Image();
    image.src = SKIN_URL;
    await image.decode();
    canvas.width = 16;
    canvas.height = 20;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 8, 8, 8, 8, 0, 0, 16, 16);
    context.drawImage(image, 40, 8, 8, 8, 0, 0, 16, 16);
  }

  const activeSkin = applyLauncherSkinState();
  const dashboardCanvas = document.querySelector("#dashboard-skin-canvas");
  Promise.allSettled([
    renderSkin3DPreviewCanvas(dashboardCanvas, activeSkin, 24, 0),
    renderSkin3DPreviewCanvas(document.querySelector("#skin-preview-canvas"), activeSkin, 14, 0),
    drawSkinHead(document.querySelector("#saved-skin-canvas"))
  ]).then(() => {
    document.querySelector("#dashboard-skin-empty")?.classList.add("hidden");
    document.querySelector("#skin-preview-empty")?.classList.add("hidden");
    const animationStartedAt = performance.now();
    let lastFrameAt = 0;
    let renderInFlight = false;
    const animateDashboardSkin = (timestamp) => {
      dashboardAnimationFrame = requestAnimationFrame(animateDashboardSkin);
      if (!document.querySelector("#dashboard")?.classList.contains("active")) return;
      if (renderInFlight || timestamp - lastFrameAt < 33) return;
      lastFrameAt = timestamp;
      renderInFlight = true;
      renderSkin3DPreviewCanvas(dashboardCanvas, activeSkin, 24, timestamp - animationStartedAt)
        .finally(() => { renderInFlight = false; });
    };
    dashboardAnimationFrame = requestAnimationFrame(animateDashboardSkin);
  });

  window.addEventListener("beforeunload", () => cancelAnimationFrame(dashboardAnimationFrame));
})();
