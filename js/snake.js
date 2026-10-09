/**
 * Snake Game Engine (snake.js)
 * Classic grid snake with speed ramp, pause/resume, high score persistence,
 * keyboard + swipe + on-screen D-Pad controls, and Web Audio feedback.
 */

(function () {
  const COLS = 20;
  const ROWS = 20;
  const START_DELAY = 140; // ms per step
  const MIN_DELAY = 60;

  let canvas = null;
  let ctx = null;
  let cell = 20;

  let snake = [];
  let dir = { x: 1, y: 0 };
  let dirQueue = [];
  let food = { x: 0, y: 0 };
  let score = 0;
  let bestScore = parseInt(localStorage.getItem("snake_best") || "0", 10);
  let state = "ready"; // ready | playing | paused | over
  let stepDelay = START_DELAY;
  let lastStep = 0;
  let rafId = null;

  // Web Audio Context
  let audioCtx = null;
  function tone(freq, duration, type, volume) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      // Audio fallback silent
    }
  }

  function isWindowVisible() {
    const win = document.getElementById("window-snake");
    return win && win.style.display !== "none" && !win.classList.contains("minimized");
  }

  function resetGame() {
    const midY = Math.floor(ROWS / 2);
    snake = [
      { x: 6, y: midY },
      { x: 5, y: midY },
      { x: 4, y: midY }
    ];
    dir = { x: 1, y: 0 };
    dirQueue = [];
    score = 0;
    stepDelay = START_DELAY;
    placeFood();
    updateScores();
    draw();
  }

  function placeFood() {
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    if (free.length === 0) return;
    food = free[Math.floor(Math.random() * free.length)];
  }

  function startGame() {
    resetGame();
    state = "playing";
    hideOverlay();
    lastStep = performance.now();
    loop(lastStep);
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      showOverlay("Paused", "Press Space or tap Resume to continue.", "Resume");
    } else if (state === "paused") {
      state = "playing";
      hideOverlay();
      lastStep = performance.now();
      loop(lastStep);
    }
  }

  function gameOver() {
    state = "over";
    tone(220, 0.3, "sawtooth", 0.12);
    showOverlay("Game Over!", `You scored ${score}. Best: ${bestScore}.`, "Play Again");
  }

  function queueDirection(x, y) {
    if (state === "ready" || state === "over") {
      startGame();
    }
    if (state !== "playing") return;

    // Compare against the last queued direction so quick double-taps can't reverse into the body
    const last = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
    if (last.x === x && last.y === y) return;
    if (last.x === -x && last.y === -y) return;
    if (dirQueue.length < 3) dirQueue.push({ x, y });
  }

  function step() {
    if (dirQueue.length) dir = dirQueue.shift();

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const willEat = head.x === food.x && head.y === food.y;
    // The tail moves away this step unless we eat, so it doesn't count as a collision
    const body = willEat ? snake : snake.slice(0, -1);

    if (
      head.x < 0 ||
      head.y < 0 ||
      head.x >= COLS ||
      head.y >= ROWS ||
      body.some((s) => s.x === head.x && s.y === head.y)
    ) {
      gameOver();
      return;
    }

    snake.unshift(head);

    if (willEat) {
      score += 10;
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("snake_best", bestScore);
      }
      stepDelay = Math.max(MIN_DELAY, stepDelay - 3);
      tone(660, 0.08, "triangle", 0.1);
      updateScores();
      placeFood();
    } else {
      snake.pop();
    }
  }

  function loop(now) {
    cancelAnimationFrame(rafId);
    if (state !== "playing") return;

    // Auto-pause when the window is closed or minimized
    if (!isWindowVisible()) {
      state = "paused";
      showOverlay("Paused", "Press Space or tap Resume to continue.", "Resume");
      return;
    }

    if (now - lastStep >= stepDelay) {
      lastStep = now;
      step();
      draw();
    }

    if (state === "playing") {
      rafId = requestAnimationFrame(loop);
    }
  }

  function draw() {
    if (!ctx) return;

    // Board background with subtle checker pattern
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#141a24" : "#18202c";
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    // Food
    const fx = food.x * cell + cell / 2;
    const fy = food.y * cell + cell / 2;
    ctx.fillStyle = "#f43f5e";
    ctx.shadowColor = "rgba(244, 63, 94, 0.7)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(fx, fy, cell * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake body (head brightest)
    snake.forEach((seg, i) => {
      const t = i / Math.max(1, snake.length - 1);
      ctx.fillStyle = i === 0 ? "#4ade80" : `rgba(34, 197, 94, ${1 - t * 0.55})`;
      roundRect(seg.x * cell + 1, seg.y * cell + 1, cell - 2, cell - 2, 5);
    });

    // Eyes on the head
    const head = snake[0];
    if (head) {
      ctx.fillStyle = "#0f172a";
      const cx = head.x * cell + cell / 2;
      const cy = head.y * cell + cell / 2;
      const ox = dir.y !== 0 ? cell * 0.2 : 0;
      const oy = dir.x !== 0 ? cell * 0.2 : 0;
      const fwdX = dir.x * cell * 0.15;
      const fwdY = dir.y * cell * 0.15;
      ctx.beginPath();
      ctx.arc(cx - ox + fwdX, cy - oy + fwdY, 2, 0, Math.PI * 2);
      ctx.arc(cx + ox + fwdX, cy + oy + fwdY, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function updateScores() {
    const scoreEl = document.getElementById("snake-score");
    const bestEl = document.getElementById("snake-best");
    if (scoreEl) scoreEl.textContent = score;
    if (bestEl) bestEl.textContent = bestScore;
  }

  function showOverlay(title, msg, btnText) {
    const overlay = document.getElementById("snake-overlay");
    const titleEl = document.getElementById("snake-overlay-title");
    const msgEl = document.getElementById("snake-overlay-msg");
    const btn = document.getElementById("snake-overlay-btn");
    if (!overlay) return;
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;
    if (btn) btn.textContent = btnText;
    overlay.classList.add("active");
  }

  function hideOverlay() {
    const overlay = document.getElementById("snake-overlay");
    if (overlay) overlay.classList.remove("active");
  }

  function onOverlayButton() {
    if (state === "paused") togglePause();
    else startGame();
  }

  // Keyboard Event Listener
  window.addEventListener("keydown", (e) => {
    if (!isWindowVisible()) return;

    if (["ArrowUp", "KeyW"].includes(e.code)) {
      e.preventDefault();
      queueDirection(0, -1);
    } else if (["ArrowDown", "KeyS"].includes(e.code)) {
      e.preventDefault();
      queueDirection(0, 1);
    } else if (["ArrowLeft", "KeyA"].includes(e.code)) {
      e.preventDefault();
      queueDirection(-1, 0);
    } else if (["ArrowRight", "KeyD"].includes(e.code)) {
      e.preventDefault();
      queueDirection(1, 0);
    } else if (e.code === "Space") {
      e.preventDefault();
      if (state === "playing" || state === "paused") togglePause();
      else startGame();
    }
  });

  // Touch Swipe on Board
  function setupTouchEvents() {
    const frame = document.getElementById("snake-board-frame");
    if (!frame) return;

    let startX = 0;
    let startY = 0;

    frame.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );

    frame.addEventListener(
      "touchend",
      (e) => {
        if (e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        const minSwipe = 24;

        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipe) {
          queueDirection(dx > 0 ? 1 : -1, 0);
        } else if (Math.abs(dy) > minSwipe) {
          queueDirection(0, dy > 0 ? 1 : -1);
        }
      },
      { passive: true }
    );
  }

  // Initialize Controls
  document.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("snake-canvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    cell = canvas.width / COLS;

    const newBtn = document.getElementById("snake-new-btn");
    const pauseBtn = document.getElementById("snake-pause-btn");
    const overlayBtn = document.getElementById("snake-overlay-btn");

    if (newBtn) newBtn.addEventListener("click", startGame);
    if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
    if (overlayBtn) overlayBtn.addEventListener("click", onOverlayButton);

    const dpad = {
      "snake-dpad-up": [0, -1],
      "snake-dpad-down": [0, 1],
      "snake-dpad-left": [-1, 0],
      "snake-dpad-right": [1, 0]
    };
    Object.keys(dpad).forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener("click", () => queueDirection(dpad[id][0], dpad[id][1]));
    });

    setupTouchEvents();
    resetGame();
    showOverlay("Snake", "Eat the apples, avoid the walls and your tail.", "Start Game");
  });
})();
