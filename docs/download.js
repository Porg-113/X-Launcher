const repo = "Porg-113/X-Launcher";
const primary = document.querySelector("#download");
const secondary = document.querySelector("#download-bottom");
const info = document.querySelector("#release-info");

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!reduceMotion) {
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 3;
  let framePending = false;

  window.addEventListener("pointermove", (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      document.documentElement.style.setProperty("--mouse-x", `${pointerX}px`);
      document.documentElement.style.setProperty("--mouse-y", `${pointerY}px`);
      framePending = false;
    });
  }, { passive: true });

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
    secondary.href = installer.browser_download_url;
    info.textContent = `${release.tag_name} · ${(installer.size / 1024 / 1024).toFixed(0)} MB`;
  })
  .catch(() => {
    info.textContent = "Neueste Version auf GitHub ansehen";
  });
