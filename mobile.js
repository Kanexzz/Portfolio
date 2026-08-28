/**
 * Mobile iOS System Controller (mobile.js)
 * Handles live clock, date, Spotlight search filter, multi-page SpringBoard slider,
 * interactive pagination dots, touch swipe gestures, and app launches.
 */

(function () {
  let currentPageIndex = 0;
  const totalPages = 3;

  function updateMobileClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const timeStr = `${hours}:${minutes}`;

    const statusBarTime = document.getElementById("ios-live-time");
    const widgetClock = document.getElementById("ios-widget-clock");
    const widgetDate = document.getElementById("ios-widget-date");

    if (statusBarTime) statusBarTime.textContent = timeStr;
    if (widgetClock) widgetClock.textContent = timeStr;

    if (widgetDate) {
      const options = { weekday: "long", month: "long", day: "numeric" };
      widgetDate.textContent = now.toLocaleDateString("en-US", options);
    }
  }

  function goToPage(pageIndex) {
    if (pageIndex < 0) pageIndex = 0;
    if (pageIndex >= totalPages) pageIndex = totalPages - 1;

    currentPageIndex = pageIndex;

    const track = document.getElementById("ios-pages-track");
    if (track) {
      track.style.transform = `translateX(-${(currentPageIndex * 100) / totalPages}%)`;
    }

    const dots = document.querySelectorAll("#ios-page-dots .ios-dot");
    dots.forEach((dot, idx) => {
      if (idx === currentPageIndex) {
        dot.classList.add("active");
      } else {
        dot.classList.remove("active");
      }
    });
  }

  function setupSpringBoardPagination() {
    const dots = document.querySelectorAll("#ios-page-dots .ios-dot");
    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        const pageIdx = parseInt(dot.getAttribute("data-page-index"), 10);
        if (!isNaN(pageIdx)) {
          goToPage(pageIdx);
        }
      });
    });

    // Touch Swipe Left / Right Detection on SpringBoard Viewport
    const viewport = document.getElementById("ios-pages-viewport");
    if (!viewport) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let isSwiping = false;

    viewport.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        isSwiping = true;
      },
      { passive: true }
    );

    viewport.addEventListener(
      "touchend",
      (e) => {
        if (!isSwiping) return;
        isSwiping = false;

        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;

        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;

        // Ensure horizontal intent (more horizontal than vertical)
        if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
          if (deltaX < 0) {
            // Swiped left -> next page
            goToPage(currentPageIndex + 1);
          } else {
            // Swiped right -> prev page
            goToPage(currentPageIndex - 1);
          }
        }
      },
      { passive: true }
    );
  }

  function setupMobileAppLaunchers() {
    const appButtons = document.querySelectorAll(".ios-app-item, .ios-dock-item");

    appButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-url");
        if (url) {
          if (url.startsWith("mailto:")) {
            window.location.href = url;
          } else {
            window.open(url, "_blank", "noopener,noreferrer");
          }
          return;
        }

        const windowId = btn.getAttribute("data-window");
        const projectId = btn.getAttribute("data-project");

        if (windowId && window.WindowManager) {
          window.WindowManager.open(windowId);

          if (projectId) {
            setTimeout(() => {
              const projectsWin = document.getElementById("window-projects");
              if (!projectsWin) return;
              const cards = projectsWin.querySelectorAll(".xp-content-card");
              cards.forEach((card) => {
                const title = card.querySelector(".xp-card-title")?.textContent.toLowerCase() || "";
                if (
                  (projectId === "logistic" && title.includes("logistic")) ||
                  (projectId === "faculty" && title.includes("faculty")) ||
                  (projectId === "procurement" && title.includes("procurement")) ||
                  (projectId === "air-combat" && title.includes("logistic")) ||
                  (projectId === "depth-charge" && title.includes("faculty")) ||
                  (projectId === "tank-battle" && title.includes("procurement"))
                ) {
                  card.scrollIntoView({ behavior: "smooth", block: "center" });
                  card.style.outline = "2px solid #38bdf8";
                  setTimeout(() => (card.style.outline = "none"), 2000);
                }
              });
            }, 150);
          }
        }
      });
    });
  }

  function setupSpotlightSearch() {
    const searchInput = document.getElementById("ios-search-input");
    const clearBtn = document.getElementById("ios-search-clear");
    const appItems = document.querySelectorAll(".ios-app-grid .ios-app-item");

    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.trim().toLowerCase();

      if (clearBtn) {
        clearBtn.style.display = query.length > 0 ? "flex" : "none";
      }

      appItems.forEach((item) => {
        const title = (item.getAttribute("data-title") || item.textContent).toLowerCase();
        if (query === "" || title.includes(query)) {
          item.style.display = "flex";
        } else {
          item.style.display = "none";
        }
      });
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        clearBtn.style.display = "none";
        appItems.forEach((item) => (item.style.display = "flex"));
        searchInput.focus();
      });
    }
  }

  function returnToHomepage() {
    const openWindows = document.querySelectorAll(".xp-window");
    openWindows.forEach((w) => {
      w.style.display = "none";
      w.classList.remove("active");
    });

    goToPage(0);

    const activePage = document.querySelector(".ios-page");
    if (activePage) {
      activePage.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (window.TaskbarManager) {
      window.TaskbarManager.update();
    }
  }

  function setupMobileNavigation() {
    const homeBar = document.getElementById("ios-home-bar");
    if (homeBar) {
      homeBar.addEventListener("click", returnToHomepage);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateMobileClock();
    setInterval(updateMobileClock, 1000);
    setupSpringBoardPagination();
    setupMobileAppLaunchers();
    setupSpotlightSearch();
    setupMobileNavigation();
  });
})();
