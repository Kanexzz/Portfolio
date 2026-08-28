/**
 * Ubuntu Desktop Portfolio - Window Management System (windows.js)
 * Interactive Ubuntu Yaru window management with left dock synchronization.
 */

window.WindowManager = {
  activeWindowId: null,
  highestZIndex: 100,
  windowsState: {},

  /**
   * Initialize all windows, controls, and event listeners
   */
  init: function () {
    const windows = document.querySelectorAll(".xp-window");

    windows.forEach((win) => {
      const windowId = win.getAttribute("id").replace("window-", "");
      
      // Store clean centered initial state & positions (no cascading overlay)
      this.windowsState[windowId] = {
        isOpen: false,
        isMinimized: false,
        isMaximized: false,
        prevTop: "48px",
        prevLeft: "calc(var(--dock-width) + 36px)",
        prevWidth: win.style.width || "680px",
        prevHeight: win.style.height || "480px"
      };

      // Set initial position
      win.style.top = this.windowsState[windowId].prevTop;
      win.style.left = this.windowsState[windowId].prevLeft;

      // Bring to front on mousedown
      win.addEventListener("mousedown", () => {
        this.bringToFront(windowId);
      });

      // Title bar control buttons
      const minBtn = win.querySelector(".xp-btn-min");
      const maxBtn = win.querySelector(".xp-btn-max");
      const closeBtn = win.querySelector(".xp-btn-close");
      const titlebar = win.querySelector(".xp-titlebar");

      if (minBtn) {
        minBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.minimize(windowId);
        });
      }

      if (maxBtn) {
        maxBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.toggleMaximize(windowId);
        });
      }

      if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.close(windowId);
        });
      }

      // Titlebar dragging & double-click maximize
      if (titlebar) {
        this.makeDraggable(win, titlebar, windowId);
        titlebar.addEventListener("dblclick", (e) => {
          if (!e.target.closest(".xp-titlebar-controls")) {
            this.toggleMaximize(windowId);
          }
        });
      }
    });
  },

  /**
   * Opens or restores a window
   * @param {string} windowId
   */
  open: function (windowId) {
    if (windowId === "tetris" && window.innerWidth <= 768) {
      if (window.showToast) {
        window.showToast("🎮", "Tetris Battle is available on PC & Desktop only!");
      } else {
        alert("Tetris Battle is available on PC & Desktop only for keyboard controls!");
      }
      return;
    }

    const win = document.getElementById("window-" + windowId);
    if (!win) return;

    // Close / hide all other open windows to prevent overlaying/cascading clutter
    const allWindows = document.querySelectorAll(".xp-window");
    allWindows.forEach((otherWin) => {
      const otherId = otherWin.getAttribute("id").replace("window-", "");
      if (otherId !== windowId && otherWin.style.display !== "none") {
        otherWin.style.display = "none";
        otherWin.classList.remove("active");
        if (this.windowsState[otherId]) {
          this.windowsState[otherId].isOpen = false;
        }
        this.updateDockState(otherId, false);
      }
    });

    // Center window nicely on desktop canvas if not on mobile
    if (window.innerWidth > 768 && !win.classList.contains("maximized")) {
      const dockWidth = 64;
      const topPanelHeight = 30;
      const availWidth = window.innerWidth - dockWidth;
      const winWidth = parseInt(win.style.width, 10) || 680;
      const centerLeft = dockWidth + Math.max(20, Math.round((availWidth - winWidth) / 2));
      const centerTop = topPanelHeight + 20;

      win.style.top = centerTop + "px";
      win.style.left = centerLeft + "px";
    }

    const state = this.windowsState[windowId] || {};

    win.style.display = "flex";
    win.classList.remove("minimized");
    state.isOpen = true;
    state.isMinimized = false;

    this.bringToFront(windowId);
    this.updateDockState(windowId, true);
    this.updateTopPanelAppTitle(windowId);
  },

  /**
   * Closes a window
   * @param {string} windowId
   */
  close: function (windowId) {
    const win = document.getElementById("window-" + windowId);
    if (!win) return;

    win.style.display = "none";
    win.classList.remove("active");

    if (this.windowsState[windowId]) {
      this.windowsState[windowId].isOpen = false;
      this.windowsState[windowId].isMinimized = false;
    }

    this.updateDockState(windowId, false);

    if (this.activeWindowId === windowId) {
      this.activeWindowId = null;
      this.focusNextOpenWindow();
    }
  },

  /**
   * Minimizes window to Ubuntu dock
   * @param {string} windowId
   */
  minimize: function (windowId) {
    const win = document.getElementById("window-" + windowId);
    if (!win) return;

    win.classList.add("minimized");
    win.classList.remove("active");

    if (this.windowsState[windowId]) {
      this.windowsState[windowId].isMinimized = true;
    }

    // Keep running pip on dock, but not active
    const dockItem = document.querySelector(`.dock-item[data-window="${windowId}"]`);
    if (dockItem) {
      dockItem.classList.remove("active");
    }

    if (this.activeWindowId === windowId) {
      this.activeWindowId = null;
      this.focusNextOpenWindow();
    }
  },

  /**
   * Maximizes or Restores window
   * @param {string} windowId
   */
  toggleMaximize: function (windowId) {
    const win = document.getElementById("window-" + windowId);
    if (!win) return;

    const state = this.windowsState[windowId];
    const maxBtn = win.querySelector(".xp-btn-max");

    if (win.classList.contains("maximized")) {
      // Restore
      win.classList.remove("maximized");
      win.style.top = state.prevTop;
      win.style.left = state.prevLeft;
      win.style.width = state.prevWidth;
      win.style.height = state.prevHeight;
      state.isMaximized = false;
      if (maxBtn) maxBtn.title = "Maximize";
    } else {
      // Maximize
      state.prevTop = win.style.top;
      state.prevLeft = win.style.left;
      state.prevWidth = win.style.width;
      state.prevHeight = win.style.height;

      win.classList.add("maximized");
      state.isMaximized = true;
      if (maxBtn) maxBtn.title = "Restore";
    }

    this.bringToFront(windowId);
  },

  /**
   * Brings specified window to front and updates active indicator
   * @param {string} windowId
   */
  bringToFront: function (windowId) {
    const win = document.getElementById("window-" + windowId);
    if (!win) return;

    document.querySelectorAll(".xp-window").forEach((w) => {
      w.classList.remove("active");
    });

    this.highestZIndex += 1;
    win.style.zIndex = this.highestZIndex;
    win.classList.add("active");
    this.activeWindowId = windowId;

    // Update Dock indicators
    document.querySelectorAll(".dock-item").forEach((item) => {
      if (item.getAttribute("data-window") === windowId) {
        item.classList.add("active", "running");
      } else {
        item.classList.remove("active");
      }
    });

    this.updateTopPanelAppTitle(windowId);
  },

  /**
   * Focuses the next top-most open window
   */
  focusNextOpenWindow: function () {
    let topWinId = null;
    let maxZ = -1;

    Object.keys(this.windowsState).forEach((id) => {
      const state = this.windowsState[id];
      if (state.isOpen && !state.isMinimized) {
        const win = document.getElementById("window-" + id);
        const z = parseInt(win.style.zIndex || "0", 10);
        if (z > maxZ) {
          maxZ = z;
          topWinId = id;
        }
      }
    });

    if (topWinId) {
      this.bringToFront(topWinId);
    } else {
      this.updateTopPanelAppTitle(null);
    }
  },

  /**
   * Updates the dock item running state indicator
   * @param {string} windowId
   * @param {boolean} isOpen
   */
  updateDockState: function (windowId, isOpen) {
    const dockItem = document.querySelector(`.dock-item[data-window="${windowId}"]`);
    if (!dockItem) return;

    if (isOpen) {
      dockItem.classList.add("running", "active");
    } else {
      dockItem.classList.remove("running", "active");
    }
  },

  /**
   * Updates the active application name on the Ubuntu top panel
   * @param {string|null} windowId
   */
  updateTopPanelAppTitle: function (windowId) {
    const appTitleEl = document.getElementById("panel-app-title");
    if (!appTitleEl) return;

    if (!windowId) {
      appTitleEl.textContent = "Ubuntu Desktop";
      return;
    }

    const win = document.getElementById("window-" + windowId);
    const titleText = win ? win.querySelector(".xp-titlebar-title span")?.textContent : windowId;
    appTitleEl.textContent = titleText || "Ubuntu Desktop";
  },

  /**
   * Makes a window draggable by its headerbar within desktop bounds
   * @param {HTMLElement} win
   * @param {HTMLElement} handle
   * @param {string} windowId
   */
  makeDraggable: function (win, handle, windowId) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    const onStart = (e) => {
      if (e.target.closest(".xp-titlebar-controls")) return;
      if (win.classList.contains("maximized")) return;

      isDragging = true;
      this.bringToFront(windowId);

      const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;

      startX = clientX;
      startY = clientY;
      initialLeft = win.offsetLeft;
      initialTop = win.offsetTop;

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onEnd);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onEnd);
    };

    const onMove = (e) => {
      if (!isDragging) return;
      if (e.cancelable) e.preventDefault();

      const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - startX;
      const deltaY = clientY - startY;

      let newLeft = initialLeft + deltaX;
      let newTop = initialTop + deltaY;

      const desktop = document.getElementById("desktop");
      const desktopWidth = desktop ? desktop.clientWidth : window.innerWidth;
      const desktopHeight = desktop ? desktop.clientHeight : window.innerHeight - 28;

      newLeft = Math.max(-win.offsetWidth + 80, Math.min(newLeft, desktopWidth - 80));
      newTop = Math.max(0, Math.min(newTop, desktopHeight - 40));

      win.style.left = newLeft + "px";
      win.style.top = newTop + "px";

      if (this.windowsState[windowId]) {
        this.windowsState[windowId].prevLeft = newLeft + "px";
        this.windowsState[windowId].prevTop = newTop + "px";
      }
    };

    const onEnd = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };

    handle.addEventListener("mousedown", onStart);
    handle.addEventListener("touchstart", onStart, { passive: true });
  }
};

document.addEventListener("DOMContentLoaded", () => {
  window.WindowManager.init();
});
