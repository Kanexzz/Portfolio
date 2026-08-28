/**
 * Ubuntu GNOME Mines (Minesweeper) Game Engine (minesweeper.js)
 * Fully interactive classic Minesweeper with safe first-click, chording,
 * difficulty presets, timer, flag counter, and Web Audio feedback.
 */

(function () {
  const PRESETS = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    expert: { rows: 16, cols: 30, mines: 99 }
  };

  let currentDifficulty = "easy";
  let rows = 9;
  let cols = 9;
  let totalMines = 10;
  let board = [];
  let gameState = "ready"; // "ready", "playing", "won", "lost"
  let flagsPlaced = 0;
  let timerSeconds = 0;
  let timerInterval = null;
  let firstClick = true;
  let flagMode = false; // For mobile toggle

  // Audio Context synthesis
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

      if (type === "click") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === "flag") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(880, now + 0.04);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === "win") {
        // Arpeggio fanfare
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const noteOsc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          noteOsc.type = "sine";
          noteOsc.frequency.setValueAtTime(freq, now + i * 0.1);
          noteGain.gain.setValueAtTime(0.15, now + i * 0.1);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
          noteOsc.connect(noteGain);
          noteGain.connect(ctx.destination);
          noteOsc.start(now + i * 0.1);
          noteOsc.stop(now + i * 0.1 + 0.25);
        });
      } else if (type === "explode") {
        // Low boom noise
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {
      // Audio fallback
    }
  }

  function initMinesweeper() {
    const diffSelect = document.getElementById("mines-difficulty-select");
    const faceBtn = document.getElementById("mines-face-btn");
    const flagToggleBtn = document.getElementById("mines-flag-toggle");

    if (diffSelect) {
      diffSelect.addEventListener("change", (e) => {
        currentDifficulty = e.target.value;
        const config = PRESETS[currentDifficulty] || PRESETS.easy;
        rows = config.rows;
        cols = config.cols;
        totalMines = config.mines;
        startNewGame();
      });
    }

    if (faceBtn) {
      faceBtn.addEventListener("click", () => {
        startNewGame();
      });
    }

    if (flagToggleBtn) {
      flagToggleBtn.addEventListener("click", () => {
        flagMode = !flagMode;
        flagToggleBtn.classList.toggle("active", flagMode);
      });
    }

    startNewGame();
  }

  function startNewGame() {
    const config = PRESETS[currentDifficulty] || PRESETS.easy;
    rows = config.rows;
    cols = config.cols;
    totalMines = config.mines;

    gameState = "ready";
    firstClick = true;
    flagsPlaced = 0;
    timerSeconds = 0;

    clearInterval(timerInterval);
    updateTimerDisplay();
    updateMinesDisplay();
    setFace("🙂");

    // Initialize blank board structure
    board = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          r,
          c,
          mine: false,
          revealed: false,
          flagged: false,
          count: 0
        });
      }
      board.push(row);
    }

    renderBoardDOM();
  }

  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (gameState === "playing") {
        timerSeconds++;
        if (timerSeconds > 999) timerSeconds = 999;
        updateTimerDisplay();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const timerEl = document.getElementById("mines-timer-display");
    if (timerEl) {
      timerEl.textContent = String(timerSeconds).padStart(3, "0");
    }
  }

  function updateMinesDisplay() {
    const counterEl = document.getElementById("mines-counter-display");
    if (counterEl) {
      const remaining = totalMines - flagsPlaced;
      counterEl.textContent = String(remaining).padStart(3, "0");
    }
  }

  function setFace(face) {
    const faceBtn = document.getElementById("mines-face-btn");
    if (faceBtn) {
      faceBtn.textContent = face;
    }
  }

  function placeMines(excludeR, excludeC) {
    let placed = 0;
    while (placed < totalMines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);

      // Don't place on clicked cell or immediate neighbors
      const isExcluded = Math.abs(r - excludeR) <= 1 && Math.abs(c - excludeC) <= 1;
      if (!board[r][c].mine && !isExcluded) {
        board[r][c].mine = true;
        placed++;
      }
    }

    // Calculate neighbor counts
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].mine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) {
                count++;
              }
            }
          }
          board[r][c].count = count;
        }
      }
    }
  }

  function renderBoardDOM() {
    const gridEl = document.getElementById("mines-board-grid");
    if (!gridEl) return;

    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = `repeat(${cols}, 28px)`;
    gridEl.style.gridTemplateRows = `repeat(${rows}, 28px)`;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        const cellEl = document.createElement("button");
        cellEl.className = "mines-cell";
        cellEl.setAttribute("data-row", r);
        cellEl.setAttribute("data-col", c);
        cellEl.setAttribute("type", "button");

        // Mouse Events
        cellEl.addEventListener("mousedown", (e) => {
          if (e.button === 0 && gameState !== "lost" && gameState !== "won") {
            setFace("😮");
          }
        });

        cellEl.addEventListener("mouseup", () => {
          if (gameState === "playing" || gameState === "ready") {
            setFace("🙂");
          }
        });

        // Left Click
        cellEl.addEventListener("click", (e) => {
          e.preventDefault();
          if (flagMode) {
            handleRightClick(r, c);
          } else {
            handleLeftClick(r, c);
          }
        });

        // Right Click (Flag)
        cellEl.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          handleRightClick(r, c);
        });

        gridEl.appendChild(cellEl);
      }
    }
  }

  function handleLeftClick(r, c) {
    if (gameState === "lost" || gameState === "won") return;

    const cell = board[r][c];
    if (cell.flagged) return;

    if (firstClick) {
      firstClick = false;
      gameState = "playing";
      placeMines(r, c);
      startTimer();
    }

    if (cell.revealed) {
      // Chording: If number matches flagged neighbors, reveal unflagged neighbors
      if (cell.count > 0) {
        chordCell(r, c);
      }
      return;
    }

    if (cell.mine) {
      gameOver(r, c);
      return;
    }

    revealCell(r, c);
    playSound("click");
    checkWinCondition();
  }

  function revealCell(r, c) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    const cell = board[r][c];
    if (cell.revealed || cell.flagged) return;

    cell.revealed = true;
    updateCellDOM(r, c);

    if (cell.count === 0 && !cell.mine) {
      // Flood fill neighbors
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          revealCell(r + dr, c + dc);
        }
      }
    }
  }

  function chordCell(r, c) {
    const cell = board[r][c];
    let flagsAround = 0;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          if (board[nr][nc].flagged) flagsAround++;
        }
      }
    }

    if (flagsAround === cell.count) {
      let hitMine = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const neighbor = board[nr][nc];
            if (!neighbor.revealed && !neighbor.flagged) {
              if (neighbor.mine) {
                hitMine = true;
                neighbor.revealed = true;
              } else {
                revealCell(nr, nc);
              }
            }
          }
        }
      }

      if (hitMine) {
        gameOver(r, c);
      } else {
        playSound("click");
        checkWinCondition();
      }
    }
  }

  function handleRightClick(r, c) {
    if (gameState === "lost" || gameState === "won") return;
    const cell = board[r][c];
    if (cell.revealed) return;

    cell.flagged = !cell.flagged;
    flagsPlaced += cell.flagged ? 1 : -1;
    playSound("flag");

    updateCellDOM(r, c);
    updateMinesDisplay();
    checkWinCondition();
  }

  function updateCellDOM(r, c) {
    const gridEl = document.getElementById("mines-board-grid");
    if (!gridEl) return;

    const idx = r * cols + c;
    const cellEl = gridEl.children[idx];
    if (!cellEl) return;

    const cell = board[r][c];

    cellEl.className = "mines-cell";
    cellEl.textContent = "";

    if (cell.revealed) {
      cellEl.classList.add("revealed");
      if (cell.mine) {
        cellEl.classList.add("mine");
        cellEl.textContent = "💣";
      } else if (cell.count > 0) {
        cellEl.classList.add(`num-${cell.count}`);
        cellEl.textContent = cell.count;
      }
    } else if (cell.flagged) {
      cellEl.classList.add("flagged");
      cellEl.textContent = "🚩";
    }
  }

  function checkWinCondition() {
    let unrevealedSafeCells = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        if (!cell.mine && !cell.revealed) {
          unrevealedSafeCells++;
        }
      }
    }

    if (unrevealedSafeCells === 0) {
      gameState = "won";
      clearInterval(timerInterval);
      setFace("😎");
      playSound("win");
      if (window.showToast) {
        window.showToast("🏆", "You Won! GNOME Mines Cleared!");
      }

      // Flag all remaining mines
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (board[r][c].mine && !board[r][c].flagged) {
            board[r][c].flagged = true;
            updateCellDOM(r, c);
          }
        }
      }
      flagsPlaced = totalMines;
      updateMinesDisplay();
    }
  }

  function gameOver(explodedR, explodedC) {
    gameState = "lost";
    clearInterval(timerInterval);
    setFace("😵");
    playSound("explode");
    if (window.showToast) {
      window.showToast("💥", "Game Over! Mine exploded.");
    }

    // Reveal all mines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        if (cell.mine) {
          cell.revealed = true;
          updateCellDOM(r, c);
        } else if (cell.flagged && !cell.mine) {
          // False flag
          const idx = r * cols + c;
          const cellEl = document.getElementById("mines-board-grid")?.children[idx];
          if (cellEl) {
            cellEl.textContent = "❌";
          }
        }
      }
    }

    // Highlight the trigger mine
    const triggerIdx = explodedR * cols + explodedC;
    const triggerEl = document.getElementById("mines-board-grid")?.children[triggerIdx];
    if (triggerEl) {
      triggerEl.style.backgroundColor = "#ef4444";
    }
  }

  // Export & Initialize
  document.addEventListener("DOMContentLoaded", () => {
    initMinesweeper();
  });
})();
