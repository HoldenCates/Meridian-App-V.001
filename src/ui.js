(function attachMeridianUI(root) {
  const tabs = [...document.querySelectorAll("[role='tab']")];
  const panels = [...document.querySelectorAll("[role='tabpanel']")];
  const analysisContext = document.querySelector("#analysis-context");
  const validNames = tabs.map(tab => tab.dataset.tabTarget);

  function activateTab(name, options = {}) {
    const targetName = validNames.includes(name) ? name : "overview";
    tabs.forEach(tab => {
      const active = tab.dataset.tabTarget === targetName;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && options.focus) tab.focus();
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.tabPanel !== targetName; });
    analysisContext.hidden = targetName === "data";
    if (options.updateHash !== false && location.hash !== `#${targetName}`) history.replaceState(null, "", `#${targetName}`);
    root.dispatchEvent(new CustomEvent("meridian:tabchange", { detail: { name: targetName } }));
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tabTarget));
    tab.addEventListener("keydown", event => {
      let nextIndex = null;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex !== null) {
        event.preventDefault();
        activateTab(tabs[nextIndex].dataset.tabTarget, { focus: true });
      }
    });
  });

  root.addEventListener("hashchange", () => activateTab(location.hash.slice(1), { updateHash: false }));
  activateTab(location.hash.slice(1) || "overview", { updateHash: false });
  root.MeridianUI = { activateTab };
})(window);
