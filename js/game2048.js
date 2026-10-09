/**
 * 2048 Game Engine (game2048.js)
 * Fully interactive 2048 puzzle game with tile merging, animations,
 * high score persistence, undo support, touch swipe, on-screen D-Pad, and Web Audio.
 */

(function () {
  const SIZE = 4;
  let grid = [];
  let score = 0;
  let bestScore = parseInt(localStorage.getItem("game2048_best") || "0", 10);
  let previousState = null;
  let hasWon = false;
  let keepPlaying = false;
  let isGameOver = false;

  // Web Audio Context
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "move") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.05);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === "merge") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.08);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "win") {
        // Victory Fanfare
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "triangle";
          o.frequency.setValueAtTime(freq, now + i * 0.08);
          g.gain.setValueAtTime(0.12, now + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(now + i * 0.08);
          o.stop(now + i * 0.08 + 0.25);
        });
      } else if (type === "gameover") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      // Audio fallback silent
    }
  }

  function initGame() {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    score = 0;
    hasWon = false;
    keepPlaying = false;
    isGameOver = false;
    previousState = null;

    addRandomTile();
    addRandomTile();
    updateUI();
  }

  function savePreviousState() {
    previousState = {
      grid: grid.map((row) => [...row]),
      score: score,
      hasWon: hasWon,
      isGameOver: isGameOver
    };
    const undoBtn = document.getElementById("g2048-undo-btn");
    if (undoBtn) undoBtn.disabled = false;
  }

  function undo() {
    if (!previousState) return;
    grid = previousState.grid.map((row) => [...row]);
    score = previousState.score;
    hasWon = previousState.hasWon;
    isGameOver = previousState.isGameOver;
    previousState = null;

    const undoBtn = document.getElementById("g2048-undo-btn");
    if (undoBtn) undoBtn.disabled = true;

    hideOverlay();
    updateUI();
  }

  function addRandomTile() {
    const emptyCells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) {
          emptyCells.push({ r, c });
        }
      }
    }
    if (emptyCells.length === 0) return;

    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    grid[randomCell.r][randomCell.c] = Math.random() < 0.9 ? 2 : 4;
  }

  function slide(row) {
    let arr = row.filter((val) => val !== 0);
    let points = 0;
    let merged = false;

    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        points += arr[i];
        arr.splice(i + 1, 1);
        merged = true;
        if (arr[i] === 2048 && !hasWon) {
          hasWon = true;
        }
      }
    }

    while (arr.length < SIZE) {
      arr.push(0);
    }

    return { row: arr, points, merged };
  }

  function move(direction) {
    if (isGameOver && !keepPlaying) return;

    // Check if 2048 window is open
    const win = document.getElementById("window-2048");
    if (win && win.style.display === "none") return;

    let moved = false;
    let roundPoints = 0;
    let roundMerged = false;
    const oldGrid = grid.map((row) => [...row]);

    if (direction === "left") {
      for (let r = 0; r < SIZE; r++) {
        const { row, points, merged } = slide(grid[r]);
        grid[r] = row;
        roundPoints += points;
        if (merged) roundMerged = true;
      }
    } else if (direction === "right") {
      for (let r = 0; r < SIZE; r++) {
        const reversed = [...grid[r]].reverse();
        const { row, points, merged } = slide(reversed);
        grid[r] = row.reverse();
        roundPoints += points;
        if (merged) roundMerged = true;
      }
    } else if (direction === "up") {
      for (let c = 0; c < SIZE; c++) {
        const column = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]];
        const { row, points, merged } = slide(column);
        for (let r = 0; r < SIZE; r++) {
          grid[r][c] = row[r];
        }
        roundPoints += points;
        if (merged) roundMerged = true;
      }
    } else if (direction === "down") {
      for (let c = 0; c < SIZE; c++) {
        const column = [grid[3][c], grid[2][c], grid[1][c], grid[0][c]];
        const { row, points, merged } = slide(column);
        for (let r = 0; r < SIZE; r++) {
          grid[3 - r][c] = row[r];
        }
        roundPoints += points;
        if (merged) roundMerged = true;
      }
    }

    // Check if board changed
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (oldGrid[r][c] !== grid[r][c]) {
          moved = true;
          break;
        }
      }
      if (moved) break;
    }

    if (moved) {
      savePreviousState();
      score += roundPoints;
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("game2048_best", bestScore);
      }

      playSound(roundMerged ? "merge" : "move");
      addRandomTile();
      updateUI();

      if (hasWon && !keepPlaying) {
        playSound("win");
        showOverlay("You Reached 2048!", "Magnificent! You conquered the board.", true);
      } else if (checkGameOver()) {
        isGameOver = true;
        playSound("gameover");
        showOverlay("Game Over!", "No more moves available.", false);
      }
    }
  }

  function checkGameOver() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return false;
        if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return false;
        if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return false;
      }
    }
    return true;
  }

  function showOverlay(title, msg, isWin) {
    const overlay = document.getElementById("g2048-overlay");
    const titleEl = document.getElementById("g2048-overlay-title");
    const msgEl = document.getElementById("g2048-overlay-msg");
    const keepGoingBtn = document.getElementById("g2048-keep-going-btn");

    if (!overlay || !titleEl || !msgEl) return;

    titleEl.textContent = title;
    msgEl.textContent = msg;
    if (keepGoingBtn) {
      keepGoingBtn.style.display = isWin ? "inline-block" : "none";
    }
    overlay.classList.add("active");
  }

  function hideOverlay() {
    const overlay = document.getElementById("g2048-overlay");
    if (overlay) overlay.classList.remove("active");
  }

  function updateUI() {
    const scoreEl = document.getElementById("g2048-score");
    const bestEl = document.getElementById("g2048-best");
    const gridContainer = document.getElementById("g2048-board");

    if (scoreEl) scoreEl.textContent = score;
    if (bestEl) bestEl.textContent = bestScore;

    if (!gridContainer) return;
    gridContainer.innerHTML = "";

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("div");
        cell.className = "g2048-cell";
        const val = grid[r][c];

        if (val > 0) {
          const tile = document.createElement("div");
          tile.className = `g2048-tile g2048-val-${val > 2048 ? "super" : val}`;
          tile.textContent = val;
          cell.appendChild(tile);
        }
        gridContainer.appendChild(cell);
      }
    }
  }

  // Keyboard Event Listener
  window.addEventListener("keydown", (e) => {
    const win = document.getElementById("window-2048");
    if (!win || win.style.display === "none") return;

    if (["ArrowUp", "KeyW"].includes(e.code)) {
      e.preventDefault();
      move("up");
    } else if (["ArrowDown", "KeyS"].includes(e.code)) {
      e.preventDefault();
      move("down");
    } else if (["ArrowLeft", "KeyA"].includes(e.code)) {
      e.preventDefault();
      move("left");
    } else if (["ArrowRight", "KeyD"].includes(e.code)) {
      e.preventDefault();
      move("right");
    }
  });

  // Touch Swipe on Board
  function setupTouchEvents() {
    const board = document.getElementById("g2048-board");
    if (!board) return;

    let touchStartX = 0;
    let touchStartY = 0;

    board.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );

    board.addEventListener(
      "touchend",
      (e) => {
        if (e.changedTouches.length === 1) {
          const deltaX = e.changedTouches[0].clientX - touchStartX;
          const deltaY = e.changedTouches[0].clientY - touchStartY;
          const minSwipe = 30;

          if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipe) {
            if (deltaX > 0) move("right");
            else move("left");
          } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > minSwipe) {
            if (deltaY > 0) move("down");
            else move("up");
          }
        }
      },
      { passive: true }
    );
  }

  // Initialize Controls
  document.addEventListener("DOMContentLoaded", () => {
    const restartBtn = document.getElementById("g2048-new-btn");
    const undoBtn = document.getElementById("g2048-undo-btn");
    const overlayRestart = document.getElementById("g2048-overlay-restart");
    const keepGoingBtn = document.getElementById("g2048-keep-going-btn");

    if (restartBtn) restartBtn.addEventListener("click", initGame);
    if (undoBtn) undoBtn.addEventListener("click", undo);
    if (overlayRestart) {
      overlayRestart.addEventListener("click", () => {
        hideOverlay();
        initGame();
      });
    }
    if (keepGoingBtn) {
      keepGoingBtn.addEventListener("click", () => {
        keepPlaying = true;
        hideOverlay();
      });
    }

    // D-Pad buttons for on-screen controls
    const dpadUp = document.getElementById("g2048-dpad-up");
    const dpadDown = document.getElementById("g2048-dpad-down");
    const dpadLeft = document.getElementById("g2048-dpad-left");
    const dpadRight = document.getElementById("g2048-dpad-right");

    if (dpadUp) dpadUp.addEventListener("click", () => move("up"));
    if (dpadDown) dpadDown.addEventListener("click", () => move("down"));
    if (dpadLeft) dpadLeft.addEventListener("click", () => move("left"));
    if (dpadRight) dpadRight.addEventListener("click", () => move("right"));

    setupTouchEvents();
    initGame();
  });
})();
