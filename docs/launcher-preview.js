(() => {
  const SKIN_URL = new URL("assets/skins/i-am-steve.png", document.baseURI).href;
  const toast = document.querySelector("#preview-toast");
  const sections = [...document.querySelectorAll(".content-section")];
  const navButtons = [...document.querySelectorAll(".nav-item[data-section]")];
  const viewers = [];
  let toastTimer = 0;

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

  navButtons.forEach((button) => {
    button.dataset.previewWired = "true";
    button.addEventListener("click", () => showSection(button.dataset.section));
  });

  const accountButton = document.querySelector("#username-display");
  if (accountButton) {
    accountButton.dataset.previewWired = "true";
    accountButton.addEventListener("click", () => showSection("accounts"));
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

  document.querySelectorAll("button:not([data-preview-wired])").forEach((button) => {
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

  async function createSkinViewer(canvas, options) {
    if (!canvas || !window.skinview3d?.SkinViewer) return null;
    const idle = new window.skinview3d.IdleAnimation();
    idle.speed = 0.16;
    const viewer = new window.skinview3d.SkinViewer({
      canvas,
      width: options.width,
      height: options.height,
      enableControls: false,
      background: null,
      fov: 34,
      zoom: options.zoom,
      pixelRatio: Math.min(2, Math.max(1.25, Number(window.devicePixelRatio) || 1)),
      animation: idle
    });
    viewer.renderer.setClearColor(0x000000, 0);
    viewer.globalLight.intensity = 2.6;
    viewer.cameraLight.intensity = 0.7;
    await viewer.loadSkin(SKIN_URL, { model: "default" });
    viewer.playerObject.rotation.y = -0.2;
    viewer.playerObject.position.set(0, -3.5, 0);
    viewer.camera.position.set(0, 7, 58);
    viewer.camera.lookAt(0, 8, 0);
    viewer.camera.updateProjectionMatrix();
    canvas.classList.remove("hidden");
    canvas.setAttribute("aria-hidden", "false");
    viewers.push(viewer);
    return viewer;
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

  Promise.allSettled([
    createSkinViewer(document.querySelector("#dashboard-skin-canvas"), { width: 460, height: 720, zoom: 0.74 }),
    createSkinViewer(document.querySelector("#skin-preview-canvas"), { width: 330, height: 420, zoom: 0.8 }),
    drawSkinHead(document.querySelector("#saved-skin-canvas"))
  ]).then(() => {
    document.querySelector("#dashboard-skin-empty")?.classList.add("hidden");
    document.querySelector("#skin-preview-empty")?.classList.add("hidden");
  });

  window.addEventListener("beforeunload", () => viewers.forEach((viewer) => viewer.dispose()));
})();
