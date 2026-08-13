const repo = "Porg-113/X-Launcher";
const primary = document.querySelector("#download");
const secondary = document.querySelector("#download-bottom");
const info = document.querySelector("#release-info");

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
