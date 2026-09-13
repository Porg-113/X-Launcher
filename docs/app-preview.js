(() => {
  const preview = document.querySelector("#app-preview");
  if (!preview) return;

  const translatePreview = (key) => window.xClientTranslate?.(key) || key;
  const toast = preview.querySelector(".demo-toast");
  let toastTimer = 0;

  function showToast(key) {
    window.clearTimeout(toastTimer);
    toast.dataset.messageKey = key;
    toast.textContent = translatePreview(key);
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  function showSection(sectionName) {
    preview.querySelectorAll("[data-demo-panel]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.demoPanel === sectionName);
    });
    preview.querySelectorAll("[data-demo-section]").forEach((button) => {
      const active = button.dataset.demoSection === sectionName;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    preview.querySelector(".demo-content")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  preview.querySelectorAll("[data-demo-section]").forEach((button) => {
    button.addEventListener("click", () => showSection(button.dataset.demoSection));
  });

  preview.querySelectorAll("[data-demo-section-link]").forEach((button) => {
    button.addEventListener("click", () => showSection(button.dataset.demoSectionLink));
  });

  preview.querySelectorAll(".demo-switch").forEach((button) => {
    button.addEventListener("click", () => {
      const enabled = !button.classList.contains("is-on");
      button.classList.toggle("is-on", enabled);
      button.setAttribute("aria-checked", String(enabled));
      if (button.hasAttribute("data-demo-motion")) {
        preview.classList.toggle("demo-no-motion", !enabled);
      }
    });
  });

  preview.querySelectorAll("[data-demo-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.demoTab;
      preview.querySelectorAll("[data-demo-tab]").forEach((tab) => tab.classList.toggle("is-active", tab === button));
      preview.querySelectorAll("[data-demo-category]").forEach((item) => {
        item.hidden = category !== "all" && item.dataset.demoCategory !== category;
      });
    });
  });

  const searchInput = preview.querySelector("[data-demo-search]");
  const searchResults = [...preview.querySelectorAll("[data-search-name]")];
  const emptySearch = preview.querySelector(".demo-empty");
  function filterSearch() {
    const query = searchInput.value.trim().toLowerCase();
    let visibleResults = 0;
    searchResults.forEach((result) => {
      const searchableText = `${result.dataset.searchName} ${result.textContent}`.toLowerCase();
      const visible = !query || searchableText.includes(query);
      result.hidden = !visible;
      if (visible) visibleResults += 1;
    });
    emptySearch.hidden = visibleResults > 0;
  }
  searchInput?.addEventListener("input", filterSearch);
  preview.querySelector("[data-demo-search-button]")?.addEventListener("click", filterSearch);

  preview.querySelectorAll("[data-demo-select-group]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const selected = event.target.closest("button");
      if (!selected || !group.contains(selected)) return;
      group.querySelectorAll("button").forEach((button) => button.classList.toggle("is-selected", button === selected));

      if (selected.classList.contains("demo-server-card")) {
        const serverName = selected.querySelector("strong")?.textContent;
        const output = preview.querySelector("[data-demo-server-name]");
        if (serverName && output) output.textContent = serverName;
      }

      if (selected.classList.contains("demo-skin-card")) {
        const skinName = selected.dataset.skinName;
        const skinColor = selected.dataset.skinColor;
        const output = preview.querySelector("[data-demo-skin-name]");
        const skinPreview = preview.querySelector(".demo-skin-preview");
        if (skinName && output) output.textContent = skinName;
        if (skinColor && skinPreview) skinPreview.style.setProperty("--demo-accent", skinColor);
      }
    });
  });

  preview.querySelectorAll("[data-demo-color]").forEach((button) => {
    button.addEventListener("click", () => {
      preview.style.setProperty("--demo-accent", button.dataset.demoColor);
      preview.querySelectorAll("[data-demo-color]").forEach((choice) => choice.classList.toggle("is-active", choice === button));
    });
  });

  const memorySlider = preview.querySelector("[data-demo-memory]");
  const memoryOutput = preview.querySelector("[data-demo-memory-output]");
  memorySlider?.addEventListener("input", () => { memoryOutput.textContent = memorySlider.value; });

  preview.querySelectorAll("[data-demo-locked]").forEach((button) => {
    button.addEventListener("click", () => showToast(`preview.locked.${button.dataset.demoLocked}`));
  });

  const checkButton = preview.querySelector("[data-demo-check]");
  checkButton?.addEventListener("click", () => {
    checkButton.textContent = translatePreview("preview.checked");
    showToast("preview.safeCheck");
    window.setTimeout(() => { checkButton.textContent = translatePreview("preview.checkAll"); }, 1600);
  });

  const accountButton = preview.querySelector(".demo-account");
  const accountCard = preview.querySelector(".demo-account-card");
  accountButton?.addEventListener("click", () => {
    const open = accountButton.getAttribute("aria-expanded") !== "true";
    accountButton.setAttribute("aria-expanded", String(open));
    accountCard.hidden = !open;
  });
  document.addEventListener("click", (event) => {
    if (!preview.contains(event.target) || (!accountButton.contains(event.target) && !accountCard.contains(event.target))) {
      accountButton.setAttribute("aria-expanded", "false");
      accountCard.hidden = true;
    }
  });

  window.addEventListener("xclientlanguagechange", () => {
    if (toast.classList.contains("is-visible") && toast.dataset.messageKey) {
      toast.textContent = translatePreview(toast.dataset.messageKey);
    }
  });
})();
