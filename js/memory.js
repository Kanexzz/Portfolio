/**
 * Memory Match (memory.js)
 * Card-flip pairs game with a 4x4 deck of tech icons, move counter, timer,
 * best-score persistence (fewest moves), and Web Audio feedback.
 */

(function () {
  const SYMBOLS = ["💻", "🐧", "⚡", "🧠", "🚀", "🛠️", "📱", "☕"];

  let deck = [];
  let flipped = [];
  let matched = 0;
  let moves = 0;
  let seconds = 0;
  let timerId = null;
  let locked = false;
  let bestMoves = parseInt(localStorage.getItem("memory_best") || "0", 10);

  // Web Audio Context
  let audioCtx = null;
  function tone(freq, duration, type, volume, delay) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const start = audioCtx.currentTime + (delay || 0);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + duration);
    } catch (e) {
      // Audio fallback silent
    }
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function isWindowVisible() {
    const win = document.getElementById("window-memory");
    return win && win.style.display !== "none" && !win.classList.contains("minimized");
  }

  function startTimer() {
    if (timerId) return;
    timerId = setInterval(() => {
      // Only count time while the player can actually see the board
      if (!isWindowVisible()) return;
      seconds++;
      updateStats();
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  function newGame() {
    stopTimer();
    deck = shuffle([...SYMBOLS, ...SYMBOLS]);
    flipped = [];
    matched = 0;
    moves = 0;
    seconds = 0;
    locked = false;
    hideOverlay();
    renderBoard();
    updateStats();
  }

  function renderBoard() {
    const boardEl = document.getElementById("memory-board");
    if (!boardEl) return;
    boardEl.innerHTML = "";

    deck.forEach((symbol, i) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "memory-card";
      card.dataset.index = i;
      card.setAttribute("aria-label", "Hidden card");
      card.innerHTML =
        '<span class="memory-card-inner">' +
        '<span class="memory-card-face memory-card-back" aria-hidden="true">?</span>' +
        `<span class="memory-card-face memory-card-front" aria-hidden="true">${symbol}</span>` +
        "</span>";
      card.addEventListener("click", () => flipCard(card));
      boardEl.appendChild(card);
    });
  }

  function flipCard(card) {
    if (locked) return;
    if (card.classList.contains("flipped") || card.classList.contains("matched")) return;

    startTimer();
    card.classList.add("flipped");
    card.setAttribute("aria-label", deck[card.dataset.index]);
    flipped.push(card);
    tone(480, 0.05, "sine", 0.06);

    if (flipped.length < 2) return;

    moves++;
    updateStats();
    const [a, b] = flipped;

    if (deck[a.dataset.index] === deck[b.dataset.index]) {
      a.classList.add("matched");
      b.classList.add("matched");
      flipped = [];
      matched++;
      tone(660, 0.1, "triangle", 0.1);
      tone(880, 0.12, "triangle", 0.1, 0.08);
      if (matched === SYMBOLS.length) winGame();
    } else {
      locked = true;
      setTimeout(() => {
        a.classList.remove("flipped");
        b.classList.remove("flipped");
        a.setAttribute("aria-label", "Hidden card");
        b.setAttribute("aria-label", "Hidden card");
        flipped = [];
        locked = false;
      }, 750);
    }
  }

  function winGame() {
    stopTimer();
    const isRecord = bestMoves === 0 || moves < bestMoves;
    if (isRecord) {
      bestMoves = moves;
      localStorage.setItem("memory_best", bestMoves);
    }
    updateStats();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.25, "triangle", 0.12, 0.2 + i * 0.08));

    setTimeout(() => {
      showOverlay(
        isRecord ? "New Record! 🏆" : "All Pairs Found!",
        `${moves} moves in ${formatTime(seconds)}.`
      );
    }, 450);
  }

  function formatTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function updateStats() {
    const movesEl = document.getElementById("memory-moves");
    const timeEl = document.getElementById("memory-time");
    const bestEl = document.getElementById("memory-best");
    if (movesEl) movesEl.textContent = moves;
    if (timeEl) timeEl.textContent = formatTime(seconds);
    if (bestEl) bestEl.textContent = bestMoves || "—";
  }

  function showOverlay(title, msg) {
    const overlay = document.getElementById("memory-overlay");
    const titleEl = document.getElementById("memory-overlay-title");
    const msgEl = document.getElementById("memory-overlay-msg");
    if (!overlay) return;
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;
    overlay.classList.add("active");
  }

  function hideOverlay() {
    const overlay = document.getElementById("memory-overlay");
    if (overlay) overlay.classList.remove("active");
  }

  // Initialize Controls
  document.addEventListener("DOMContentLoaded", () => {
    const newBtn = document.getElementById("memory-new-btn");
    const overlayBtn = document.getElementById("memory-overlay-btn");
    if (newBtn) newBtn.addEventListener("click", newGame);
    if (overlayBtn) overlayBtn.addEventListener("click", newGame);
    newGame();
  });
})();
