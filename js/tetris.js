/**
 * Ubuntu GNOME Blocks - 1v1 Tetris Battle vs Tux AI (tetris.js)
 * Full real-time dual-board battle engine with Combo Multiplier System (Tetris Friends style),
 * zero-latency DAS/ARR hotkeys, stack-preserving KO mechanics, AI heuristics, and Web Audio.
 */

(function () {
  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 20; // 10 * 20 = 200px width, 20 * 20 = 400px height

  // Tetrominoes definitions
  const SHAPES = {
    I: {
      matrix: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ],
      color: "#06b6d4",
      stroke: "#0891b2"
    },
    J: {
      matrix: [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]
      ],
      color: "#3b82f6",
      stroke: "#2563eb"
    },
    L: {
      matrix: [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]
      ],
      color: "#f97316",
      stroke: "#ea580c"
    },
    O: {
      matrix: [
        [1, 1],
        [1, 1]
      ],
      color: "#eab308",
      stroke: "#ca8a04"
    },
    S: {
      matrix: [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]
      ],
      color: "#22c55e",
      stroke: "#16a34a"
    },
    T: {
      matrix: [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]
      ],
      color: "#a855f7",
      stroke: "#9333ea"
    },
    Z: {
      matrix: [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]
      ],
      color: "#ef4444",
      stroke: "#dc2626"
    }
  };

  const SHAPE_KEYS = Object.keys(SHAPES);

  // Match State
  let matchTime = 120; // 2 minutes match
  let matchTimerInterval = null;
  let isPlaying = false;
  let isPaused = false;
  let aiDifficulty = "medium";

  let p1WinStreak = parseInt(localStorage.getItem("tb_p1_streak") || "0", 10);
  let aiWinStreak = parseInt(localStorage.getItem("tb_ai_streak") || "0", 10);
  let p1KOs = 0;
  let aiKOs = 0;

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

  function playSound(type, extra = 1) {
    try {
      const actx = getAudioCtx();
      if (!actx) return;
      const now = actx.currentTime;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.connect(gain);
      gain.connect(actx.destination);

      if (type === "move") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(340, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
        osc.start(now);
        osc.stop(now + 0.025);
      } else if (type === "rotate") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(460, now);
        osc.frequency.setValueAtTime(680, now + 0.025);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        osc.start(now);
        osc.stop(now + 0.045);
      } else if (type === "drop") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.065);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
        osc.start(now);
        osc.stop(now + 0.065);
      } else if (type === "combo") {
        // Higher pitched chime with each combo tier!
        const baseFreq = 380 + Math.min(extra, 12) * 60;
        osc.type = "sine";
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.45, now + 0.14);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === "attack") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === "ko") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "win") {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const o = actx.createOscillator();
          const g = actx.createGain();
          o.type = "square";
          o.frequency.setValueAtTime(freq, now + i * 0.09);
          g.gain.setValueAtTime(0.1, now + i * 0.09);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.25);
          o.connect(g);
          g.connect(actx.destination);
          o.start(now + i * 0.09);
          o.stop(now + i * 0.09 + 0.25);
        });
      }
    } catch (e) {}
  }

  // --- Helper Math Functions ---
  function cloneMatrix(matrix) {
    return matrix.map((row) => [...row]);
  }

  function rotateMatrix(matrix) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        result[c][N - 1 - r] = matrix[r][c];
      }
    }
    return result;
  }

  function createBoardState() {
    return {
      grid: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
      bag: [],
      currentPiece: null,
      nextQueue: [],
      holdPiece: null,
      canHold: true,
      comboCount: -1, // -1 = no combo, 0 = 1st clear, 1+ = combo multiplier!
      b2b: false,
      pendingGarbage: 0,
      dropCounter: 0,
      dropInterval: 750,
      linesCleared: 0
    };
  }

  function getFromBag(boardState) {
    if (boardState.bag.length === 0) {
      boardState.bag = [...SHAPE_KEYS].sort(() => Math.random() - 0.5);
    }
    return boardState.bag.pop();
  }

  function makePiece(type) {
    const shape = SHAPES[type];
    return {
      type,
      matrix: cloneMatrix(shape.matrix),
      color: shape.color,
      stroke: shape.stroke,
      x: Math.floor((COLS - shape.matrix[0].length) / 2),
      y: 0
    };
  }

  function fillNextQueue(boardState) {
    while (boardState.nextQueue.length < 3) {
      boardState.nextQueue.push(makePiece(getFromBag(boardState)));
    }
  }

  function checkCollision(grid, matrix, px, py) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          const nx = px + c;
          const ny = py + r;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && grid[ny] && grid[ny][nx]) return true;
        }
      }
    }
    return false;
  }

  function getGhost(grid, piece) {
    if (!piece) return null;
    let gy = piece.y;
    while (!checkCollision(grid, piece.matrix, piece.x, gy + 1)) {
      gy++;
    }
    return { x: piece.x, y: gy };
  }

  // --- Garbage Management & Combo Attacks ---
  function applyPendingGarbage(boardState) {
    if (boardState.pendingGarbage <= 0) return;
    const linesToAdd = Math.min(boardState.pendingGarbage, 8);
    boardState.pendingGarbage -= linesToAdd;

    for (let i = 0; i < linesToAdd; i++) {
      const hole = Math.floor(Math.random() * COLS);
      const garbageRow = Array(COLS).fill({ color: "#64748b", stroke: "#475569" });
      garbageRow[hole] = 0;
      boardState.grid.shift();
      boardState.grid.push(garbageRow);
    }
  }

  // Classic Tetris Friends Combo Table:
  // 0 combos: 0 bonus | 1-2 combos: +1 | 3-4 combos: +2 | 5-6 combos: +3 | 7-8 combos: +4 | 9+ combos: +5
  function getComboBonus(combo) {
    if (combo <= 0) return 0;
    if (combo <= 2) return 1;
    if (combo <= 4) return 2;
    if (combo <= 6) return 3;
    if (combo <= 8) return 4;
    return 5;
  }

  function sendGarbage(fromPlayer, lines, combo, isB2B = false) {
    // Base lines attack: Single = 0, Double = 1, Triple = 2, Tetris = 4
    let baseAttack = 0;
    if (lines === 2) baseAttack = 1;
    else if (lines === 3) baseAttack = 2;
    else if (lines >= 4) baseAttack = 4;

    const comboBonus = getComboBonus(combo);
    const b2bBonus = isB2B && lines >= 4 ? 1 : 0;
    let totalAttack = baseAttack + comboBonus + b2bBonus;

    if (totalAttack <= 0 && combo <= 0) return;

    if (combo > 0) {
      playSound("combo", combo);
    } else {
      playSound("attack");
    }

    triggerMascotPunch(fromPlayer === "p1");

    if (fromPlayer === "p1") {
      if (p1.pendingGarbage > 0) {
        const offset = Math.min(p1.pendingGarbage, totalAttack);
        p1.pendingGarbage -= offset;
        totalAttack -= offset;
      }
      if (totalAttack > 0) {
        ai.pendingGarbage += totalAttack;
        let pillMsg = `⚡ ${totalAttack} LINES SENT!`;
        if (combo > 0) pillMsg = `🔥 ${combo} COMBO! (+${totalAttack} LINES)`;
        showAttackPill(pillMsg);
      }
    } else {
      if (ai.pendingGarbage > 0) {
        const offset = Math.min(ai.pendingGarbage, totalAttack);
        ai.pendingGarbage -= offset;
        totalAttack -= offset;
      }
      if (totalAttack > 0) {
        p1.pendingGarbage += totalAttack;
        let pillMsg = `⚠️ INCOMING +${totalAttack}!`;
        if (combo > 0) pillMsg = `🤖 AI ${combo} COMBO! (+${totalAttack})`;
        showAttackPill(pillMsg);
      }
    }
    updateGarbageBars();
  }

  function showComboPopup(isP1, combo, lines) {
    const el = document.getElementById(isP1 ? "tetris-p1-combo" : "tetris-ai-combo");
    if (!el) return;

    el.className = "t-combo-popup";

    let label = `${combo} COMBO!`;
    if (combo >= 7) {
      el.classList.add("t-combo-tier-ultra");
      label = `👑 ULTRA COMBO x${combo}!`;
    } else if (combo >= 5) {
      el.classList.add("t-combo-tier-3");
      label = `🌟 MEGA COMBO x${combo}!`;
    } else if (combo >= 3) {
      el.classList.add("t-combo-tier-2");
      label = `⚡ ${combo} COMBO!`;
    } else {
      el.classList.add("t-combo-tier-1");
      label = `🔥 ${combo} COMBO!`;
    }

    if (lines === 4) {
      label = `⚡ TETRIS! ${label}`;
    }

    el.textContent = label;
    void el.offsetWidth; // Force CSS reflow
    el.classList.add("show");

    setTimeout(() => {
      el.classList.remove("show");
    }, 1100);

    updateComboCounters();
  }

  function updateComboCounters() {
    const p1El = document.getElementById("t-p1-combo-counter");
    const aiEl = document.getElementById("t-ai-combo-counter");

    if (p1El) {
      p1El.className = "t-combo-counter";
      if (p1.comboCount >= 5) {
        p1El.textContent = `🔥 x${p1.comboCount}`;
        p1El.classList.add("hot");
      } else if (p1.comboCount > 0) {
        p1El.textContent = `x${p1.comboCount}`;
        p1El.classList.add("active");
      } else {
        p1El.textContent = "—";
      }
    }

    if (aiEl) {
      aiEl.className = "t-combo-counter";
      if (ai.comboCount >= 5) {
        aiEl.textContent = `🔥 x${ai.comboCount}`;
        aiEl.classList.add("hot");
      } else if (ai.comboCount > 0) {
        aiEl.textContent = `x${ai.comboCount}`;
        aiEl.classList.add("active");
      } else {
        aiEl.textContent = "—";
      }
    }
  }

  function updateBattleStatus(text) {
    const el = document.getElementById("t-battle-status");
    if (el) el.innerHTML = `<span>${text}</span>`;
  }

  function showAttackPill(text) {
    const pill = document.getElementById("t-attack-anim");
    if (!pill) return;
    pill.textContent = text;
    pill.classList.add("active");
    setTimeout(() => pill.classList.remove("active"), 1200);
  }

  function triggerMascotPunch(isP1) {
    const mP1 = document.getElementById("t-mascot-p1");
    const mAI = document.getElementById("t-mascot-ai");
    if (isP1 && mP1) {
      mP1.classList.add("t-punch-left");
      setTimeout(() => mP1.classList.remove("t-punch-left"), 250);
    } else if (!isP1 && mAI) {
      mAI.classList.add("t-punch-right");
      setTimeout(() => mAI.classList.remove("t-punch-right"), 250);
    }
  }

  // --- Board State Instances ---
  let p1 = createBoardState();
  let ai = createBoardState();
  let aiTarget = null;
  let aiMoveTimer = 0;

  // --- AI Decision Algorithm (Pierre Dellacherie Heuristics) ---
  function evaluateBoard(grid) {
    let aggregateHeight = 0;
    let completeLines = 0;
    let holes = 0;
    let bumpiness = 0;

    const colHeights = Array(COLS).fill(0);

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (grid[r][c]) {
          colHeights[c] = ROWS - r;
          break;
        }
      }
      aggregateHeight += colHeights[c];
    }

    for (let r = 0; r < ROWS; r++) {
      if (grid[r].every((cell) => cell !== 0)) {
        completeLines++;
      }
    }

    for (let c = 0; c < COLS; c++) {
      let blockFound = false;
      for (let r = 0; r < ROWS; r++) {
        if (grid[r][c]) blockFound = true;
        else if (blockFound && !grid[r][c]) holes++;
      }
    }

    for (let c = 0; c < COLS - 1; c++) {
      bumpiness += Math.abs(colHeights[c] - colHeights[c + 1]);
    }

    return -0.51 * aggregateHeight + 0.76 * completeLines - 0.36 * holes - 0.18 * bumpiness;
  }

  function getBestAIMove(boardState) {
    if (!boardState.currentPiece) return null;
    let bestScore = -Infinity;
    let bestMove = null;

    const basePiece = boardState.currentPiece;
    let testMatrix = cloneMatrix(basePiece.matrix);

    for (let rot = 0; rot < 4; rot++) {
      for (let x = -2; x < COLS + 2; x++) {
        if (checkCollision(boardState.grid, testMatrix, x, 0)) continue;

        let y = 0;
        while (!checkCollision(boardState.grid, testMatrix, x, y + 1)) {
          y++;
        }

        const simGrid = boardState.grid.map((r) => [...r]);
        for (let r = 0; r < testMatrix.length; r++) {
          for (let c = 0; c < testMatrix[r].length; c++) {
            if (testMatrix[r][c]) {
              const gy = y + r;
              const gx = x + c;
              if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
                simGrid[gy][gx] = 1;
              }
            }
          }
        }

        let score = evaluateBoard(simGrid);

        if (aiDifficulty === "easy") score += (Math.random() - 0.5) * 4;
        else if (aiDifficulty === "medium") score += (Math.random() - 0.5) * 1.5;

        if (score > bestScore) {
          bestScore = score;
          bestMove = { x, rot, targetY: y };
        }
      }
      testMatrix = rotateMatrix(testMatrix);
    }
    return bestMove;
  }

  function stepAI(deltaTime) {
    if (!isPlaying || isPaused || !ai.currentPiece) return;

    if (!aiTarget) {
      aiTarget = getBestAIMove(ai);
    }

    const moveSpeeds = {
      easy: 380,
      medium: 210,
      hard: 100,
      beast: 50
    };

    const speed = moveSpeeds[aiDifficulty] || 210;
    aiMoveTimer += deltaTime;

    if (aiMoveTimer >= speed) {
      aiMoveTimer = 0;

      if (!aiTarget) {
        lockAIPiece();
        return;
      }

      if (aiTarget.rot > 0) {
        const rotated = rotateMatrix(ai.currentPiece.matrix);
        if (!checkCollision(ai.grid, rotated, ai.currentPiece.x, ai.currentPiece.y)) {
          ai.currentPiece.matrix = rotated;
          aiTarget.rot--;
          return;
        }
      }

      if (ai.currentPiece.x < aiTarget.x) {
        if (!checkCollision(ai.grid, ai.currentPiece.matrix, ai.currentPiece.x + 1, ai.currentPiece.y)) {
          ai.currentPiece.x++;
          return;
        }
      } else if (ai.currentPiece.x > aiTarget.x) {
        if (!checkCollision(ai.grid, ai.currentPiece.matrix, ai.currentPiece.x - 1, ai.currentPiece.y)) {
          ai.currentPiece.x--;
          return;
        }
      }

      lockAIPiece();
    }
  }

  function lockAIPiece() {
    if (!ai.currentPiece) return;
    const ghost = getGhost(ai.grid, ai.currentPiece);
    if (!ghost) return;

    ai.currentPiece.y = ghost.y;

    for (let r = 0; r < ai.currentPiece.matrix.length; r++) {
      for (let c = 0; c < ai.currentPiece.matrix[r].length; c++) {
        if (ai.currentPiece.matrix[r][c]) {
          const gy = ai.currentPiece.y + r;
          const gx = ai.currentPiece.x + c;
          if (gy < 0) {
            triggerKO("ai");
            return;
          }
          ai.grid[gy][gx] = { color: ai.currentPiece.color, stroke: ai.currentPiece.stroke };
        }
      }
    }

    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (ai.grid[r].every((cell) => cell !== 0)) {
        ai.grid.splice(r, 1);
        ai.grid.unshift(Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }

    if (cleared > 0) {
      ai.comboCount++;
      if (ai.comboCount > 0) {
        showComboPopup(false, ai.comboCount, cleared);
      }
      sendGarbage("ai", cleared, ai.comboCount, false);
    } else {
      ai.comboCount = -1; // Reset combo if no line cleared
      updateComboCounters();
    }

    applyPendingGarbage(ai);

    ai.currentPiece = ai.nextQueue.shift();
    fillNextQueue(ai);
    aiTarget = null;
    drawNextQueue(aiNextCtx, ai.nextQueue);

    if (checkCollision(ai.grid, ai.currentPiece.matrix, ai.currentPiece.x, ai.currentPiece.y)) {
      triggerKO("ai");
    }
  }

  // --- Player 1 Logic ---
  function lockP1Piece() {
    if (!p1.currentPiece) return;

    for (let r = 0; r < p1.currentPiece.matrix.length; r++) {
      for (let c = 0; c < p1.currentPiece.matrix[r].length; c++) {
        if (p1.currentPiece.matrix[r][c]) {
          const gy = p1.currentPiece.y + r;
          const gx = p1.currentPiece.x + c;
          if (gy < 0) {
            triggerKO("p1");
            return;
          }
          p1.grid[gy][gx] = { color: p1.currentPiece.color, stroke: p1.currentPiece.stroke };
        }
      }
    }

    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (p1.grid[r].every((cell) => cell !== 0)) {
        p1.grid.splice(r, 1);
        p1.grid.unshift(Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }

    if (cleared > 0) {
      p1.comboCount++;
      const isB2B = cleared === 4 && p1.b2b;
      p1.b2b = (cleared === 4);

      if (p1.comboCount > 0 || cleared === 4) {
        showComboPopup(true, Math.max(1, p1.comboCount), cleared);
      }

      sendGarbage("p1", cleared, p1.comboCount, isB2B);
    } else {
      p1.comboCount = -1; // Reset combo when piece locks without line clear
      updateComboCounters();
    }

    applyPendingGarbage(p1);

    p1.currentPiece = p1.nextQueue.shift();
    fillNextQueue(p1);
    p1.canHold = true;
    drawNextQueue(p1NextCtx, p1.nextQueue);
    updateGarbageBars();

    if (checkCollision(p1.grid, p1.currentPiece.matrix, p1.currentPiece.x, p1.currentPiece.y)) {
      triggerKO("p1");
    }
  }

  // Clear only top overflow rows on KO (keeps existing blocks intact!)
  function trimSpawnOverflow(boardState) {
    for (let r = 0; r < 4; r++) {
      boardState.grid[r] = Array(COLS).fill(0);
    }
  }

  function triggerKO(victim) {
    playSound("ko");
    if (victim === "ai") {
      p1KOs++;
      if (window.showToast) window.showToast("💥", "TUX AI KNOCKED OUT! +1 KO");
      trimSpawnOverflow(ai);
      ai.pendingGarbage = 0;
      ai.comboCount = -1;
      ai.currentPiece = ai.nextQueue.shift();
      fillNextQueue(ai);
      aiTarget = null;
    } else {
      aiKOs++;
      if (window.showToast) window.showToast("💀", "JANRICK TOPPED OUT! +1 AI KO");
      trimSpawnOverflow(p1);
      p1.pendingGarbage = 0;
      p1.comboCount = -1;
      p1.currentPiece = p1.nextQueue.shift();
      fillNextQueue(p1);
    }
    updateGarbageBars();
    updateScoreboard();
    updateComboCounters();
    if (victim === "ai") {
      updateBattleStatus("💥 TUX AI K.O.!");
    } else {
      updateBattleStatus("💀 PLAYER K.O.!");
    }
  }

  function updateScoreboard() {
    const p1KOEl = document.getElementById("tetris-p1-ko");
    const aiKOEl = document.getElementById("tetris-ai-ko");
    const p1StrEl = document.getElementById("tetris-p1-streak");
    const aiStrEl = document.getElementById("tetris-ai-streak");

    if (p1KOEl) p1KOEl.textContent = p1KOs;
    if (aiKOEl) aiKOEl.textContent = aiKOs;
    if (p1StrEl) p1StrEl.textContent = p1WinStreak;
    if (aiStrEl) aiStrEl.textContent = aiWinStreak;
  }

  function updateGarbageBars() {
    renderGarbageBar("tetris-p1-garbage-bar", p1.pendingGarbage);
    renderGarbageBar("tetris-ai-garbage-bar", ai.pendingGarbage);
  }

  function renderGarbageBar(barId, count) {
    const bar = document.getElementById(barId);
    if (!bar) return;
    bar.innerHTML = "";
    for (let i = 0; i < Math.min(count, 12); i++) {
      const pip = document.createElement("div");
      pip.className = "t-garbage-pip";
      bar.appendChild(pip);
    }
  }

  // --- Player Controls (Instant actions) ---
  function p1MoveLeft() {
    if (!isPlaying || isPaused || !p1.currentPiece) return;
    if (!checkCollision(p1.grid, p1.currentPiece.matrix, p1.currentPiece.x - 1, p1.currentPiece.y)) {
      p1.currentPiece.x--;
      playSound("move");
    }
  }

  function p1MoveRight() {
    if (!isPlaying || isPaused || !p1.currentPiece) return;
    if (!checkCollision(p1.grid, p1.currentPiece.matrix, p1.currentPiece.x + 1, p1.currentPiece.y)) {
      p1.currentPiece.x++;
      playSound("move");
    }
  }

  function p1Rotate() {
    if (!isPlaying || isPaused || !p1.currentPiece) return;
    const rotated = rotateMatrix(p1.currentPiece.matrix);

    if (!checkCollision(p1.grid, rotated, p1.currentPiece.x, p1.currentPiece.y)) {
      p1.currentPiece.matrix = rotated;
      playSound("rotate");
    } else if (!checkCollision(p1.grid, rotated, p1.currentPiece.x - 1, p1.currentPiece.y)) {
      p1.currentPiece.x--;
      p1.currentPiece.matrix = rotated;
      playSound("rotate");
    } else if (!checkCollision(p1.grid, rotated, p1.currentPiece.x + 1, p1.currentPiece.y)) {
      p1.currentPiece.x++;
      p1.currentPiece.matrix = rotated;
      playSound("rotate");
    }
  }

  function p1SoftDrop() {
    if (!isPlaying || isPaused || !p1.currentPiece) return;
    if (!checkCollision(p1.grid, p1.currentPiece.matrix, p1.currentPiece.x, p1.currentPiece.y + 1)) {
      p1.currentPiece.y++;
    } else {
      lockP1Piece();
    }
    p1.dropCounter = 0;
  }

  function p1HardDrop() {
    if (!isPlaying || isPaused || !p1.currentPiece) return;
    const ghost = getGhost(p1.grid, p1.currentPiece);
    if (!ghost) return;
    p1.currentPiece.y = ghost.y;
    playSound("drop");
    lockP1Piece();
  }

  function p1Hold() {
    if (!isPlaying || isPaused || !p1.canHold || !p1.currentPiece) return;
    playSound("rotate");
    const currentType = p1.currentPiece.type;

    if (!p1.holdPiece) {
      p1.holdPiece = makePiece(currentType);
      p1.currentPiece = p1.nextQueue.shift();
      fillNextQueue(p1);
    } else {
      const prevHold = p1.holdPiece.type;
      p1.holdPiece = makePiece(currentType);
      p1.currentPiece = makePiece(prevHold);
    }
    p1.canHold = false;
    drawSinglePreview(p1HoldCtx, p1.holdPiece);
    drawNextQueue(p1NextCtx, p1.nextQueue);
  }

  // --- High-Performance Zero-Delay DAS/ARR Keyboard Engine ---
  const keyState = {
    left: false,
    right: false,
    down: false
  };

  const DAS_DELAY = 100; // ms before fast auto-shift repeats
  const ARR_RATE = 28;   // ms per repeated shift step
  const SOFT_DROP_RATE = 22; // ms per soft-drop step

  let dasTimer = { left: 0, right: 0, down: 0 };
  let arrTimer = { left: 0, right: 0, down: 0 };

  function handleKeyRepeat(deltaTime) {
    if (!isPlaying || isPaused) return;

    if (keyState.left && !keyState.right) {
      dasTimer.left += deltaTime;
      if (dasTimer.left >= DAS_DELAY) {
        arrTimer.left += deltaTime;
        while (arrTimer.left >= ARR_RATE) {
          p1MoveLeft();
          arrTimer.left -= ARR_RATE;
        }
      }
    }

    if (keyState.right && !keyState.left) {
      dasTimer.right += deltaTime;
      if (dasTimer.right >= DAS_DELAY) {
        arrTimer.right += deltaTime;
        while (arrTimer.right >= ARR_RATE) {
          p1MoveRight();
          arrTimer.right -= ARR_RATE;
        }
      }
    }

    if (keyState.down) {
      dasTimer.down += deltaTime;
      if (dasTimer.down >= 30) {
        arrTimer.down += deltaTime;
        while (arrTimer.down >= SOFT_DROP_RATE) {
          p1SoftDrop();
          arrTimer.down -= SOFT_DROP_RATE;
        }
      }
    }
  }

  // --- Match Initialization ---
  function startBattle() {
    p1 = createBoardState();
    ai = createBoardState();

    fillNextQueue(p1);
    fillNextQueue(ai);

    p1.currentPiece = p1.nextQueue.shift();
    ai.currentPiece = ai.nextQueue.shift();
    fillNextQueue(p1);
    fillNextQueue(ai);

    p1KOs = 0;
    aiKOs = 0;
    matchTime = 120;
    isPlaying = true;
    isPaused = false;
    aiTarget = null;
    aiMoveTimer = 0;

    keyState.left = false;
    keyState.right = false;
    keyState.down = false;

    const diffSelect = document.getElementById("tetris-difficulty-select");
    if (diffSelect) aiDifficulty = diffSelect.value;

    const startBtn = document.getElementById("tetris-start-btn");
    const pauseBtn = document.getElementById("tetris-pause-btn");
    if (startBtn) startBtn.innerHTML = '<span class="t-btn-icon">🔄</span> Restart';
    if (pauseBtn) {
      pauseBtn.innerHTML = '<span class="t-btn-icon">⏸</span> Pause';
      pauseBtn.disabled = false;
    }

    if (matchTimerInterval) clearInterval(matchTimerInterval);
    matchTimerInterval = setInterval(() => {
      if (isPlaying && !isPaused) {
        matchTime--;
        updateTimerDOM();
        if (matchTime <= 0) {
          endMatch();
        }
      }
    }, 1000);

    updateScoreboard();
    updateTimerDOM();
    updateGarbageBars();
    updateComboCounters();
    updateBattleStatus("⚔️ BATTLE IN PROGRESS");
    drawSinglePreview(p1HoldCtx, p1.holdPiece);
    drawSinglePreview(aiHoldCtx, ai.holdPiece);
    drawNextQueue(p1NextCtx, p1.nextQueue);
    drawNextQueue(aiNextCtx, ai.nextQueue);
    setOverlay(false);
  }

  function updateTimerDOM() {
    const timerEl = document.getElementById("tetris-timer");
    if (!timerEl) return;
    const mins = Math.floor(matchTime / 60);
    const secs = matchTime % 60;
    timerEl.textContent = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function endMatch() {
    isPlaying = false;
    if (matchTimerInterval) clearInterval(matchTimerInterval);

    let winner = "tie";
    if (p1KOs > aiKOs) winner = "p1";
    else if (aiKOs > p1KOs) winner = "ai";

    if (winner === "p1") {
      p1WinStreak++;
      aiWinStreak = 0;
      playSound("win");
      localStorage.setItem("tb_p1_streak", p1WinStreak);
      localStorage.setItem("tb_ai_streak", "0");
      setOverlay(true, "🏆 JANRICK WINS!", `Final Score: ${p1KOs} KO vs ${aiKOs} KO<br>Win Streak: ${p1WinStreak}`);
      if (window.showToast) window.showToast("🏆", "VICTORY! You defeated Tux AI!");
      updateBattleStatus("🏆 VICTORY!");
    } else if (winner === "ai") {
      aiWinStreak++;
      p1WinStreak = 0;
      playSound("ko");
      localStorage.setItem("tb_ai_streak", aiWinStreak);
      localStorage.setItem("tb_p1_streak", "0");
      setOverlay(true, "💀 TUX AI WINS!", `Final Score: ${aiKOs} KO vs ${p1KOs} KO<br>Better luck next round!`);
      if (window.showToast) window.showToast("🤖", "Tux AI won this match!");
      updateBattleStatus("💀 DEFEATED");
    } else {
      setOverlay(true, "🤝 MATCH DRAW", `Both players tied at ${p1KOs} KO!`);
      updateBattleStatus("🤝 DRAW");
    }

    updateScoreboard();
  }

  function togglePause() {
    if (!isPlaying) return;
    isPaused = !isPaused;
    const pauseBtn = document.getElementById("tetris-pause-btn");
    if (pauseBtn) {
      pauseBtn.innerHTML = isPaused
        ? '<span class="t-btn-icon">▶</span> Resume'
        : '<span class="t-btn-icon">⏸</span> Pause';
    }

    if (isPaused) {
      setOverlay(true, "Battle Paused", "Press P or Resume to continue match");
      updateBattleStatus("⏸ PAUSED");
    } else {
      setOverlay(false);
      updateBattleStatus("⚔️ BATTLE IN PROGRESS");
    }
  }

  function setOverlay(show, title = "", msg = "") {
    const overlay = document.getElementById("tetris-overlay");
    const titleEl = document.getElementById("tetris-overlay-title");
    const msgEl = document.getElementById("tetris-overlay-msg");
    const overlayBtn = document.getElementById("tetris-overlay-start-btn");
    if (!overlay) return;

    if (show) {
      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.innerHTML = msg;
      if (overlayBtn) overlayBtn.textContent = isPlaying && isPaused ? "▶ RESUME" : "⚔️ START BATTLE";
      overlay.style.display = "flex";
    } else {
      overlay.style.display = "none";
    }
  }

  // --- Rendering Functions ---
  let p1Canvas, p1Ctx, aiCanvas, aiCtx;
  let p1HoldCanvas, p1HoldCtx, aiHoldCanvas, aiHoldCtx;
  let p1NextCanvas, p1NextCtx, aiNextCanvas, aiNextCtx;
  let lastFrameTime = 0;

  function drawBlock(context, x, y, color, stroke, isGhost = false) {
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;

    if (isGhost) {
      context.fillStyle = "rgba(255, 255, 255, 0.08)";
      context.fillRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      context.strokeStyle = "rgba(255, 255, 255, 0.35)";
      context.lineWidth = 1;
      context.strokeRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      return;
    }

    context.fillStyle = color;
    context.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

    // Bevel highlights
    context.fillStyle = "rgba(255, 255, 255, 0.4)";
    context.fillRect(px, py, BLOCK_SIZE, 2.5);
    context.fillRect(px, py, 2.5, BLOCK_SIZE);

    context.fillStyle = "rgba(0, 0, 0, 0.35)";
    context.fillRect(px, py + BLOCK_SIZE - 2.5, BLOCK_SIZE, 2.5);
    context.fillRect(px + BLOCK_SIZE - 2.5, py, 2.5, BLOCK_SIZE);

    context.strokeStyle = stroke || "rgba(0, 0, 0, 0.5)";
    context.lineWidth = 1;
    context.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
  }

  function drawSinglePreview(context, piece) {
    if (!context) return;
    context.clearRect(0, 0, 60, 60);
    if (!piece) return;

    const matrix = piece.matrix;
    const size = 12;
    const offsetX = Math.floor((60 - matrix[0].length * size) / 2);
    const offsetY = Math.floor((60 - matrix.length * size) / 2);

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          context.fillStyle = piece.color;
          context.fillRect(offsetX + c * size, offsetY + r * size, size, size);
          context.strokeStyle = piece.stroke;
          context.strokeRect(offsetX + c * size, offsetY + r * size, size, size);
        }
      }
    }
  }

  function drawNextQueue(context, queue) {
    if (!context) return;
    context.clearRect(0, 0, 60, 180);

    queue.slice(0, 3).forEach((piece, index) => {
      const matrix = piece.matrix;
      const size = 11;
      const offsetX = Math.floor((60 - matrix[0].length * size) / 2);
      const offsetY = 10 + index * 56 + Math.floor((40 - matrix.length * size) / 2);

      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c]) {
            context.fillStyle = piece.color;
            context.fillRect(offsetX + c * size, offsetY + r * size, size, size);
            context.strokeStyle = piece.stroke;
            context.strokeRect(offsetX + c * size, offsetY + r * size, size, size);
          }
        }
      }
    });
  }

  function renderBoard(context, canvas, boardState) {
    if (!context || !canvas) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "#0c0f18";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "rgba(255, 255, 255, 0.04)";
    context.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      context.beginPath();
      context.moveTo(c * BLOCK_SIZE, 0);
      context.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
      context.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      context.beginPath();
      context.moveTo(0, r * BLOCK_SIZE);
      context.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE);
      context.stroke();
    }

    // Locked blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (boardState.grid[r] && boardState.grid[r][c]) {
          drawBlock(context, c, r, boardState.grid[r][c].color, boardState.grid[r][c].stroke);
        }
      }
    }

    // Ghost Piece & Falling Piece
    if (isPlaying && boardState.currentPiece) {
      const ghost = getGhost(boardState.grid, boardState.currentPiece);
      if (ghost) {
        for (let r = 0; r < boardState.currentPiece.matrix.length; r++) {
          for (let c = 0; c < boardState.currentPiece.matrix[r].length; c++) {
            if (boardState.currentPiece.matrix[r][c]) {
              drawBlock(context, ghost.x + c, ghost.y + r, "", "", true);
            }
          }
        }
      }

      for (let r = 0; r < boardState.currentPiece.matrix.length; r++) {
        for (let c = 0; c < boardState.currentPiece.matrix[r].length; c++) {
          if (boardState.currentPiece.matrix[r][c]) {
            drawBlock(
              context,
              boardState.currentPiece.x + c,
              boardState.currentPiece.y + r,
              boardState.currentPiece.color,
              boardState.currentPiece.stroke
            );
          }
        }
      }
    }
  }

  function gameLoop(time = 0) {
    if (!lastFrameTime) lastFrameTime = time;
    let deltaTime = time - lastFrameTime;
    if (deltaTime > 200 || deltaTime < 0 || isNaN(deltaTime)) deltaTime = 16.6;
    lastFrameTime = time;

    if (isPlaying && !isPaused) {
      // Process fast DAS/ARR input
      handleKeyRepeat(deltaTime);

      // P1 gravity
      p1.dropCounter += deltaTime;
      if (p1.dropCounter > p1.dropInterval) {
        p1SoftDrop();
        p1.dropCounter = 0;
      }

      // AI step
      stepAI(deltaTime);
    }

    // Draw both boards
    renderBoard(p1Ctx, p1Canvas, p1);
    renderBoard(aiCtx, aiCanvas, ai);

    requestAnimationFrame(gameLoop);
  }

  // --- Keyboard Event Setup ---
  function setupControls() {
    window.addEventListener("keydown", (e) => {
      const win = document.getElementById("window-tetris");
      if (!win || win.style.display === "none") return;

      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        if (!keyState.left) {
          keyState.left = true;
          dasTimer.left = 0;
          arrTimer.left = 0;
          p1MoveLeft();
        }
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        if (!keyState.right) {
          keyState.right = true;
          dasTimer.right = 0;
          arrTimer.right = 0;
          p1MoveRight();
        }
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        if (!keyState.down) {
          keyState.down = true;
          dasTimer.down = 0;
          arrTimer.down = 0;
          p1SoftDrop();
        }
      } else if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "KeyK") {
        e.preventDefault();
        if (!e.repeat) {
          p1Rotate();
        }
      } else if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) {
          p1HardDrop();
        }
      } else if (e.code === "KeyC" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
        e.preventDefault();
        if (!e.repeat) {
          p1Hold();
        }
      } else if (e.code === "KeyP") {
        e.preventDefault();
        if (!e.repeat) {
          togglePause();
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        keyState.left = false;
        dasTimer.left = 0;
        arrTimer.left = 0;
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        keyState.right = false;
        dasTimer.right = 0;
        arrTimer.right = 0;
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        keyState.down = false;
        dasTimer.down = 0;
        arrTimer.down = 0;
      }
    });

    window.addEventListener("blur", () => {
      keyState.left = false;
      keyState.right = false;
      keyState.down = false;
    });

    // Match Action Buttons
    document.getElementById("tetris-start-btn")?.addEventListener("click", () => startBattle());
    document.getElementById("tetris-overlay-start-btn")?.addEventListener("click", () => {
      if (isPaused) togglePause();
      else startBattle();
    });
    document.getElementById("tetris-pause-btn")?.addEventListener("click", () => togglePause());

    document.getElementById("tetris-difficulty-select")?.addEventListener("change", (e) => {
      aiDifficulty = e.target.value;
    });
  }

  function initTetris() {
    p1Canvas = document.getElementById("tetris-p1-canvas");
    if (p1Canvas) p1Ctx = p1Canvas.getContext("2d");

    aiCanvas = document.getElementById("tetris-ai-canvas");
    if (aiCanvas) aiCtx = aiCanvas.getContext("2d");

    p1HoldCanvas = document.getElementById("tetris-p1-hold-canvas");
    if (p1HoldCanvas) p1HoldCtx = p1HoldCanvas.getContext("2d");

    aiHoldCanvas = document.getElementById("tetris-ai-hold-canvas");
    if (aiHoldCanvas) aiHoldCtx = aiHoldCanvas.getContext("2d");

    p1NextCanvas = document.getElementById("tetris-p1-next-canvas");
    if (p1NextCanvas) p1NextCtx = p1NextCanvas.getContext("2d");

    aiNextCanvas = document.getElementById("tetris-ai-next-canvas");
    if (aiNextCanvas) aiNextCtx = aiNextCanvas.getContext("2d");

    setupControls();
    updateScoreboard();
    updateTimerDOM();
    setOverlay(true, "TETRIS BATTLE", "1v1 Real-Time Battle vs Tux AI<br><span style=\"font-size: 11px; opacity: 0.85;\">Clear lines & build Combos to send massive garbage attacks!</span>");
    requestAnimationFrame(gameLoop);
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTetris();
  });
})();
