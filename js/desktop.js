/**
 * Ubuntu Desktop Portfolio - Desktop & Dock Interactions (desktop.js)
 * Manages Ubuntu Left Dock, Desktop shortcuts, and App Grid overview.
 */

document.addEventListener("DOMContentLoaded", () => {
  initDock();
  initDesktopShortcuts();
  initAppGrid();
});

/**
 * Initialize Ubuntu Left Dock launcher interactions
 */
function initDock() {
  const dockItems = document.querySelectorAll(".dock-item[data-window]");

  dockItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const windowId = item.getAttribute("data-window");
      if (!windowId || !window.WindowManager) return;

      const state = window.WindowManager.windowsState[windowId];
      if (!state || !state.isOpen) {
        window.WindowManager.open(windowId);
      } else if (state.isMinimized) {
        window.WindowManager.open(windowId);
      } else if (window.WindowManager.activeWindowId === windowId) {
        window.WindowManager.minimize(windowId);
      } else {
        window.WindowManager.bringToFront(windowId);
      }
    });
  });
}

/**
 * Initialize Desktop Shortcut Icons
 */
function initDesktopShortcuts() {
  const icons = document.querySelectorAll(".desktop-icon");
  const desktop = document.getElementById("desktop");

  icons.forEach((icon) => {
    icon.addEventListener("click", (e) => {
      e.stopPropagation();
      deselectAllIcons();
      icon.classList.add("selected");
      icon.focus();

      const targetWindowId = icon.getAttribute("data-window");
      if (targetWindowId && window.WindowManager) {
        window.WindowManager.open(targetWindowId);
      }
    });

    icon.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      const targetWindowId = icon.getAttribute("data-window");
      if (targetWindowId && window.WindowManager) {
        window.WindowManager.open(targetWindowId);
      }
    });
  });

  if (desktop) {
    desktop.addEventListener("click", (e) => {
      if (e.target === desktop || e.target.classList.contains("desktop-icons-container")) {
        deselectAllIcons();
      }
    });
  }
}

function deselectAllIcons() {
  document.querySelectorAll(".desktop-icon").forEach((icon) => {
    icon.classList.remove("selected");
  });
}

/**
 * Initialize Ubuntu GNOME 9-Dot App Grid Overview
 */
function initAppGrid() {
  const gridBtn = document.getElementById("dock-grid-btn");
  const overlay = document.getElementById("app-grid-overlay");
  const searchInput = document.getElementById("app-grid-search");
  const gridItems = document.querySelectorAll(".app-grid-item");

  if (!gridBtn || !overlay) return;

  // Toggle App Grid
  gridBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    overlay.classList.toggle("open");
    gridBtn.classList.toggle("active");
    if (overlay.classList.contains("open") && searchInput) {
      searchInput.value = "";
      filterGridItems("");
      searchInput.focus();
    }
  });

  // Close when clicking outside grid items
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.remove("open");
      gridBtn.classList.remove("active");
    }
  });

  // ESC key closes overlay
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("open")) {
      overlay.classList.remove("open");
      gridBtn.classList.remove("active");
    }
  });

  // Clicking an app grid item launches the window
  gridItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const windowId = item.getAttribute("data-window");
      overlay.classList.remove("open");
      gridBtn.classList.remove("active");
      if (windowId && window.WindowManager) {
        window.WindowManager.open(windowId);
      }
    });
  });

  // Filter Switcher Buttons (Frequent / All)
  const frequentBtn = document.getElementById("app-filter-frequent");
  const allBtn = document.getElementById("app-filter-all");
  let currentTab = "frequent";

  function applyFilters() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

    gridItems.forEach((item) => {
      const label = item.querySelector(".app-grid-label")?.textContent.toLowerCase() || "";
      const isFrequent = item.getAttribute("data-frequent") === "true";

      const matchesSearch = query === "" || label.includes(query);
      const matchesTab = query !== "" || currentTab === "all" || isFrequent;

      if (matchesSearch && matchesTab) {
        item.style.display = "flex";
      } else {
        item.style.display = "none";
      }
    });
  }

  if (frequentBtn) {
    frequentBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      currentTab = "frequent";
      frequentBtn.classList.add("active");
      frequentBtn.setAttribute("aria-selected", "true");
      if (allBtn) {
        allBtn.classList.remove("active");
        allBtn.setAttribute("aria-selected", "false");
      }
      applyFilters();
    });
  }

  if (allBtn) {
    allBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      currentTab = "all";
      allBtn.classList.add("active");
      allBtn.setAttribute("aria-selected", "true");
      if (frequentBtn) {
        frequentBtn.classList.remove("active");
        frequentBtn.setAttribute("aria-selected", "false");
      }
      applyFilters();
    });
  }

  // Live search input
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      applyFilters();
    });
  }

  // Reset state on open
  gridBtn.addEventListener("click", () => {
    if (overlay.classList.contains("open")) {
      currentTab = "frequent";
      if (frequentBtn) frequentBtn.classList.add("active");
      if (allBtn) allBtn.classList.remove("active");
      if (searchInput) searchInput.value = "";
      applyFilters();
    }
  });
}
