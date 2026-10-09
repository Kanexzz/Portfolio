/**
 * Flappy Penguin (flappy.js)
 * Tap / click / Space to flap through pipe gaps. Frame-rate independent physics,
 * auto-pause when hidden, high score persistence, and Web Audio feedback.
 */

(function () {
  const W = 320;
  const H = 480;
  const GROUND = 56;
  const GRAVITY = 1500; // px/s^2
  const FLAP_VELOCITY = -430; // px/s
  const PIPE_SPEED = 140; // px/s
  const PIPE_WIDTH = 54;
  const PIPE_GAP = 132;
  const PIPE_SPACING = 190; // px between pipes
  const BIRD_X = 84;
  const BIRD_R = 13;

  let canvas = null;
  let ctx = null;
  let bird = { y: H / 2, vy: 0 };
  let pipes = [];
  let groundOffset = 0;
  let score = 0;
  let bestScore = parseInt(localStorage.getItem("flappy_best") || "0", 10);
  let state = "ready"; // ready | playing | paused | over
  let lastTime = 0;
  let rafId = null;
  let overAt = 0;

  // Web Audio Context
  let audioCtx = null;
  function tone(freq, endFreq, duration, type, volume) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
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
    const win = document.getElementById("window-flappy");
    return win && win.style.display !== "none" && !win.classList.contains("minimized");
  }

  function resetGame() {
    bird = { y: H / 2 - 30, vy: 0 };
    pipes = [];
    score = 0;
    for (let i = 0; i < 3; i++) spawnPipe(W + 80 + i * PIPE_SPACING);
    updateScores();
  }

  function spawnPipe(x) {
    const minTop = 50;
    const maxTop = H - GROUND - PIPE_GAP - 50;
    pipes.push({ x, top: minTop + Math.random() * (maxTop - minTop), passed: false });
  }

  function flap() {
    if (!isWindowVisible()) return;

    if (state === "ready") {
      state = "playing";
      hideOverlay();
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    } else if (state === "paused") {
      resume();
      return;
    } else if (state === "over") {
      // Short grace period so a frantic tap doesn't instantly restart
      if (performance.now() - overAt < 500) return;
      resetGame();
      state = "ready";
      showOverlay("Get Ready", "Tap, click, or press Space to flap.", "");
      draw();
      return;
    }

    bird.vy = FLAP_VELOCITY;
    tone(520, 760, 0.08, "sine", 0.07);
  }

  function pause() {
    if (state !== "playing") return;
    state = "paused";
    cancelAnimationFrame(rafId);
    showOverlay("Paused", "Tap or press Space to resume.", "");
  }

  function resume() {
    state = "playing";
    hideOverlay();
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function crash() {
    state = "over";
    overAt = performance.now();
    cancelAnimationFrame(rafId);
    tone(300, 90, 0.35, "sawtooth", 0.12);
    showOverlay("Game Over!", `Score: ${score}  ·  Best: ${bestScore}`, "Tap to try again");
  }

  function update(dt) {
    bird.vy += GRAVITY * dt;
    bird.y += bird.vy * dt;
    groundOffset = (groundOffset + PIPE_SPEED * dt) % 24;

    pipes.forEach((p) => {
      p.x -= PIPE_SPEED * dt;
      if (!p.passed && p.x + PIPE_WIDTH < BIRD_X) {
        p.passed = true;
        score++;
        if (score > bestScore) {
          bestScore = score;
          localStorage.setItem("flappy_best", bestScore);
        }
        updateScores();
        tone(880, 1200, 0.07, "triangle", 0.08);
      }
    });

    if (pipes.length && pipes[0].x + PIPE_WIDTH < 0) {
      pipes.shift();
      spawnPipe(pipes[pipes.length - 1].x + PIPE_SPACING);
    }

    // Collisions: ceiling, ground, pipes (circle vs rectangle)
    if (bird.y - BIRD_R < 0) {
      bird.y = BIRD_R;
      bird.vy = 0;
    }
    if (bird.y + BIRD_R >= H - GROUND) {
      bird.y = H - GROUND - BIRD_R;
      crash();
      return;
    }
    for (const p of pipes) {
      if (BIRD_X + BIRD_R < p.x || BIRD_X - BIRD_R > p.x + PIPE_WIDTH) continue;
      if (circleHitsRect(p.x, 0, PIPE_WIDTH, p.top) ||
          circleHitsRect(p.x, p.top + PIPE_GAP, PIPE_WIDTH, H - GROUND - p.top - PIPE_GAP)) {
        crash();
        return;
      }
    }
  }

  function circleHitsRect(rx, ry, rw, rh) {
    const nx = Math.max(rx, Math.min(BIRD_X, rx + rw));
    const ny = Math.max(ry, Math.min(bird.y, ry + rh));
    const dx = BIRD_X - nx;
    const dy = bird.y - ny;
    return dx * dx + dy * dy < BIRD_R * BIRD_R;
  }

  function loop(now) {
    if (state !== "playing") return;
    if (!isWindowVisible()) {
      pause();
      return;
    }

    // Clamp dt so a background tab or hitch doesn't teleport the bird
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();

    if (state === "playing") rafId = requestAnimationFrame(loop);
  }

  function draw() {
    if (!ctx) return;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#1e3a8a");
    sky.addColorStop(1, "#7c3aed");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    [[30, 40], [110, 90], [200, 30], [270, 120], [60, 170], [240, 210], [150, 150]].forEach(([x, y]) => {
      ctx.fillRect(x, y, 2, 2);
    });

    // Pipes
    pipes.forEach((p) => {
      drawPipe(p.x, 0, p.top, true);
      drawPipe(p.x, p.top + PIPE_GAP, H - GROUND - p.top - PIPE_GAP, false);
    });

    // Ground
    ctx.fillStyle = "#3f2d1f";
    ctx.fillRect(0, H - GROUND, W, GROUND);
    ctx.fillStyle = "#16a34a";
    ctx.fillRect(0, H - GROUND, W, 10);
    ctx.fillStyle = "#15803d";
    for (let x = -groundOffset; x < W; x += 24) {
      ctx.fillRect(x, H - GROUND, 12, 10);
    }

    drawBird();

    // Live score
    if (state !== "ready") {
      ctx.font = "800 40px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(15, 23, 42, 0.8)";
      ctx.strokeText(score, W / 2, 64);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(score, W / 2, 64);
    }
  }

  function drawPipe(x, y, h, isTop) {
    if (h <= 0) return;
    const grad = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
    grad.addColorStop(0, "#15803d");
    grad.addColorStop(0.5, "#4ade80");
    grad.addColorStop(1, "#166534");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, PIPE_WIDTH, h);

    // Lip
    const lipH = 18;
    const lipY = isTop ? y + h - lipH : y;
    ctx.fillRect(x - 4, lipY, PIPE_WIDTH + 8, lipH);
    ctx.strokeStyle = "rgba(15, 23, 42, 0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, lipY, PIPE_WIDTH + 8, lipH);
  }

  function drawBird() {
    // Tilt with vertical speed
    const angle = Math.max(-0.5, Math.min(1.2, bird.vy / 600));
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(angle);

    // Body
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_R + 2, BIRD_R, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belly
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.ellipse(2, 3, BIRD_R - 4, BIRD_R - 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(6, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(7, -5, 2, 0, Math.PI * 2);
    ctx.fill();
    // Beak
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(BIRD_R, -2);
    ctx.lineTo(BIRD_R + 9, 1);
    ctx.lineTo(BIRD_R, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function updateScores() {
    const scoreEl = document.getElementById("flappy-score");
    const bestEl = document.getElementById("flappy-best");
    if (scoreEl) scoreEl.textContent = score;
    if (bestEl) bestEl.textContent = bestScore;
  }

  function showOverlay(title, msg, hint) {
    const overlay = document.getElementById("flappy-overlay");
    const titleEl = document.getElementById("flappy-overlay-title");
    const msgEl = document.getElementById("flappy-overlay-msg");
    const hintEl = document.getElementById("flappy-overlay-hint");
    if (!overlay) return;
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;
    if (hintEl) hintEl.textContent = hint;
    overlay.classList.add("active");
  }

  function hideOverlay() {
    const overlay = document.getElementById("flappy-overlay");
    if (overlay) overlay.classList.remove("active");
  }

  // Keyboard Event Listener
  window.addEventListener("keydown", (e) => {
    if (!isWindowVisible()) return;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      if (!e.repeat) flap();
    } else if (e.code === "KeyP") {
      if (state === "playing") pause();
      else if (state === "paused") resume();
    }
  });

  // Initialize Controls
  document.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("flappy-canvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");

    // pointerdown covers mouse, pen, and touch with a single listener
    const stage = document.getElementById("flappy-stage");
    if (stage) {
      stage.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        flap();
      });
    }

    resetGame();
    draw();
    showOverlay("Flappy Penguin", "Tap, click, or press Space to flap.", "");
  });
})();
