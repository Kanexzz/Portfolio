/**
 * Ubuntu Desktop Portfolio - Top Panel & Quick Settings System (taskbar.js)
 * Fully interactive GNOME Top Panel, Popovers, Web Audio Volume,
 * Wi-Fi, Dark Mode, Lock Screen, and Power Off Dialog.
 */

document.addEventListener("DOMContentLoaded", () => {
  initTopPanelClock();
  initPanelPopovers();
  initActivitiesButton();
  initQuickSettingsControls();
  initLockScreen();
  initPowerModal();
});

/**
 * Toast Notification System
 * @param {string} icon 
 * @param {string} message 
 */
window.showToast = function (icon, message) {
  const toast = document.getElementById("ubuntu-toast");
  const toastIcon = document.getElementById("toast-icon");
  const toastText = document.getElementById("toast-text");

  if (!toast) return;

  if (toastIcon) toastIcon.textContent = icon;
  if (toastText) toastText.textContent = message;

  toast.classList.add("show");

  if (window._toastTimeout) clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
};

/**
 * Audio Context feedback sound for volume changes
 */
let audioCtx = null;
function playBeep(volumePercent) {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    if (volumePercent <= 0) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(520, audioCtx.currentTime); // gentle pleasant chime tone

    gain.gain.setValueAtTime((volumePercent / 100) * 0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (e) {
    // AudioContext fallback
  }
}

/**
 * Initialize Real-time GNOME Clock in Top Panel & Lock Screen
 */
function initTopPanelClock() {
  const clockBtn = document.getElementById("panel-clock-btn");
  const calHeader = document.getElementById("cal-today-header");
  const lockTime = document.getElementById("lock-time");
  const lockDate = document.getElementById("lock-date");

  function updateClock() {
    const now = new Date();
    
    // Top Panel Format: "Fri Aug 28  08:08 AM"
    const dayName = now.toLocaleDateString(undefined, { weekday: "short" });
    const monthName = now.toLocaleDateString(undefined, { month: "short" });
    const dayNum = now.getDate();
    
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;

    if (clockBtn) {
      clockBtn.textContent = `${dayName} ${monthName} ${dayNum}  ${hours}:${minutes} ${ampm}`;
    }

    if (calHeader) {
      calHeader.textContent = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }

    if (lockTime) {
      lockTime.textContent = `${hours}:${minutes}`;
    }

    if (lockDate) {
      lockDate.textContent = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    }
  }

  updateClock();
  setInterval(updateClock, 1000);
}

/**
 * Initialize Top Panel Popovers Toggle
 */
function initPanelPopovers() {
  const clockBtn = document.getElementById("panel-clock-btn");
  const calPopover = document.getElementById("calendar-popover");
  
  const sysPill = document.getElementById("system-menu-btn");
  const sysPopover = document.getElementById("quick-settings-popover");

  if (clockBtn && calPopover) {
    clockBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (sysPopover) sysPopover.classList.remove("open");
      if (sysPill) sysPill.classList.remove("active");
      
      calPopover.classList.toggle("open");
      clockBtn.classList.toggle("active");
    });
  }

  if (sysPill && sysPopover) {
    sysPill.addEventListener("click", (e) => {
      e.stopPropagation();
      if (calPopover) calPopover.classList.remove("open");
      if (clockBtn) clockBtn.classList.remove("active");

      sysPopover.classList.toggle("open");
      sysPill.classList.toggle("active");
    });
  }

  // Close popovers when clicking outside
  document.addEventListener("click", (e) => {
    if (calPopover && !calPopover.contains(e.target) && !clockBtn.contains(e.target)) {
      calPopover.classList.remove("open");
      clockBtn.classList.remove("active");
    }

    if (sysPopover && !sysPopover.contains(e.target) && !sysPill.contains(e.target)) {
      sysPopover.classList.remove("open");
      sysPill.classList.remove("active");
    }
  });

  // ESC key closes popovers
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (calPopover) calPopover.classList.remove("open");
      if (clockBtn) clockBtn.classList.remove("active");
      if (sysPopover) sysPopover.classList.remove("open");
      if (sysPill) sysPill.classList.remove("active");
    }
  });
}

/**
 * Initialize Interactive Quick Settings Controls
 */
function initQuickSettingsControls() {
  const slider = document.getElementById("quick-volume-slider");
  const sliderIcon = document.getElementById("quick-volume-icon");
  const panelVolIcon = document.querySelector(".panel-sys-icon[src*='volume']");
  let prevVolume = 80;

  // 1. Volume Slider
  if (slider) {
    const updateVolumeUI = (val) => {
      if (val == 0) {
        if (sliderIcon) sliderIcon.textContent = "🔇";
        if (panelVolIcon) panelVolIcon.style.opacity = "0.4";
      } else if (val < 35) {
        if (sliderIcon) sliderIcon.textContent = "🔈";
        if (panelVolIcon) panelVolIcon.style.opacity = "0.7";
      } else if (val < 70) {
        if (sliderIcon) sliderIcon.textContent = "🔉";
        if (panelVolIcon) panelVolIcon.style.opacity = "0.9";
      } else {
        if (sliderIcon) sliderIcon.textContent = "🔊";
        if (panelVolIcon) panelVolIcon.style.opacity = "1";
      }
    };

    slider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      updateVolumeUI(val);
      playBeep(val);
    });

    // Toggle Mute on clicking speaker icon
    if (sliderIcon) {
      sliderIcon.addEventListener("click", () => {
        if (slider.value > 0) {
          prevVolume = slider.value;
          slider.value = 0;
          updateVolumeUI(0);
          window.showToast("🔇", "Volume: Muted");
        } else {
          slider.value = prevVolume || 80;
          updateVolumeUI(slider.value);
          playBeep(slider.value);
          window.showToast("🔊", `Volume: ${slider.value}%`);
        }
      });
    }
  }

  // 2. Wi-Fi Toggle
  const wifiToggle = document.getElementById("quick-toggle-wifi");
  const panelWifiIcon = document.querySelector(".panel-sys-icon[src*='wifi']");
  if (wifiToggle) {
    wifiToggle.addEventListener("click", () => {
      const isNowActive = !wifiToggle.classList.contains("active");
      wifiToggle.classList.toggle("active", isNowActive);

      if (panelWifiIcon) {
        panelWifiIcon.style.opacity = isNowActive ? "1" : "0.3";
      }

      window.showToast(
        isNowActive ? "📶" : "🚫",
        isNowActive ? "Wi-Fi: Connected (100 Mbps)" : "Wi-Fi: Disconnected"
      );
    });
  }

  // 3. High Performance Toggle
  const perfToggle = document.getElementById("quick-toggle-perf");
  if (perfToggle) {
    perfToggle.addEventListener("click", () => {
      const isNowActive = !perfToggle.classList.contains("active");
      perfToggle.classList.toggle("active", isNowActive);

      window.showToast(
        isNowActive ? "⚡" : "🔋",
        isNowActive ? "Power Mode: High Performance" : "Power Mode: Balanced / Power Saver"
      );
    });
  }

  // 4. Dark Mode Toggle with persistence
  const darkToggle = document.getElementById("quick-toggle-dark");
  const storedTheme = localStorage.getItem("ubuntu_theme");

  if (storedTheme === "light") {
    document.body.classList.add("light-theme");
    if (darkToggle) {
      darkToggle.classList.remove("active");
      darkToggle.innerHTML = '<span class="setting-toggle-icon">☀️</span> Light Mode';
    }
  }

  if (darkToggle) {
    darkToggle.addEventListener("click", () => {
      const isCurrentlyDark = !document.body.classList.contains("light-theme");

      if (isCurrentlyDark) {
        // Switch to Light Mode
        document.body.classList.add("light-theme");
        darkToggle.classList.remove("active");
        darkToggle.innerHTML = '<span class="setting-toggle-icon">☀️</span> Light Mode';
        localStorage.setItem("ubuntu_theme", "light");
        window.showToast("☀️", "Light Mode: Activated");
      } else {
        // Switch to Dark Mode
        document.body.classList.remove("light-theme");
        darkToggle.classList.add("active");
        darkToggle.innerHTML = '<span class="setting-toggle-icon">🌙</span> Dark Mode';
        localStorage.setItem("ubuntu_theme", "dark");
        window.showToast("🌙", "Dark Mode: Activated");
      }
    });
  }

  // 5. Lock Screen Toggle
  const lockToggle = document.getElementById("quick-toggle-lock");
  if (lockToggle) {
    lockToggle.addEventListener("click", () => {
      closeQuickSettings();
      window.lockScreen();
    });
  }

  // 6. Power Options Button
  const powerBtn = document.getElementById("quick-power-btn");
  if (powerBtn) {
    powerBtn.addEventListener("click", () => {
      closeQuickSettings();
      window.openPowerModal();
    });
  }
}

function closeQuickSettings() {
  const popover = document.getElementById("quick-settings-popover");
  const pill = document.getElementById("system-menu-btn");
  if (popover) popover.classList.remove("open");
  if (pill) pill.classList.remove("active");
}

/**
 * Initialize Ubuntu Lock Screen Flow
 */
function initLockScreen() {
  const lockScreen = document.getElementById("ubuntu-lock-screen");
  const lockInput = document.getElementById("lock-password-input");

  window.lockScreen = function () {
    if (lockScreen) {
      lockScreen.classList.add("active");
      if (lockInput) {
        lockInput.value = "";
        setTimeout(() => lockInput.focus(), 150);
      }
    }
  };

  window.unlockScreen = function () {
    if (lockScreen) {
      lockScreen.classList.remove("active");
      window.showToast("👋", "Welcome back, Janrick!");
    }
  };
}

/**
 * Initialize Ubuntu Power Off Modal & Shutdown Simulation
 */
function initPowerModal() {
  const powerModal = document.getElementById("ubuntu-power-modal");
  const cancelBtn = document.getElementById("power-cancel-btn");
  const restartBtn = document.getElementById("power-restart-btn");
  const offBtn = document.getElementById("power-off-btn");

  const shutdownScreen = document.getElementById("ubuntu-shutdown-screen");
  const onBtn = document.getElementById("power-on-btn");

  window.openPowerModal = function () {
    if (powerModal) powerModal.classList.add("active");
  };

  if (cancelBtn && powerModal) {
    cancelBtn.addEventListener("click", () => {
      powerModal.classList.remove("active");
    });
  }

  if (restartBtn) {
    restartBtn.addEventListener("click", () => {
      if (powerModal) powerModal.classList.remove("active");
      window.showToast("🔄", "Restarting Ubuntu Desktop...");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });
  }

  if (offBtn && shutdownScreen) {
    offBtn.addEventListener("click", () => {
      if (powerModal) powerModal.classList.remove("active");
      shutdownScreen.classList.add("active");
    });
  }

  if (onBtn && shutdownScreen) {
    onBtn.addEventListener("click", () => {
      shutdownScreen.classList.remove("active");
      window.showToast("🚀", "Ubuntu Desktop is ready");
    });
  }
}

/**
 * Initialize Activities Overview Button
 */
function initActivitiesButton() {
  const activitiesBtn = document.getElementById("activities-btn");
  const overlay = document.getElementById("app-grid-overlay");
  const gridBtn = document.getElementById("dock-grid-btn");

  if (activitiesBtn && overlay) {
    activitiesBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      overlay.classList.toggle("open");
      if (gridBtn) gridBtn.classList.toggle("active");
    });
  }
}
