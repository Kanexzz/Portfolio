/**
 * Mancala (mancala.js)
 * Kalah rules vs computer: 6 pits x 4 seeds, extra turn when the last seed lands in
 * your store, captures from an empty own pit, minimax AI with selectable depth,
 * animated sowing, persistent win/loss record, and Web Audio feedback.
 *
 * Board indices (counter-clockwise):
 *   0-5  = player pits (bottom row, left -> right)     6  = player store (right)
 *   7-12 = computer pits (top row, right -> left)      13 = computer store (left)
 */

(function () {
  const PLAYER_STORE = 6;
  const AI_STORE = 13;
  const SEEDS = 4;
  const SOW_STEP_MS = 110;
  const DEPTHS = { easy: 1, medium: 3, hard: 6 };

  let board = [];
  let playerTurn = true;
  let animating = false;
  let gameOver = false;
  let aiTimer = null;
  let stats = loadStats();

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

  function loadStats() {
    try {
      const saved = JSON.parse(localStorage.getItem("mancala_stats") || "null");
      if (saved && typeof saved.win === "number") return saved;
    } catch (e) {
      // Corrupt storage falls back to zeros
    }
    return { win: 0, loss: 0 };
  }

  /* ---------- Rules (pure, used by both play and AI search) ---------- */

  function ownPits(isPlayer) {
    return isPlayer ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
  }

  function validMoves(b, isPlayer) {
    return ownPits(isPlayer).filter((i) => b[i] > 0);
  }

  /**
   * Sows seeds from a pit. Returns the resulting board, whether the mover earns
   * an extra turn, the list of indices each seed landed in (for animation),
   * and any capture that happened.
   */
  function sow(b, pit, isPlayer) {
    const next = b.slice();
    const path = [];
    const skipStore = isPlayer ? AI_STORE : PLAYER_STORE;
    const myStore = isPlayer ? PLAYER_STORE : AI_STORE;

    let seeds = next[pit];
    next[pit] = 0;
    let i = pit;
    while (seeds > 0) {
      i = (i + 1) % 14;
      if (i === skipStore) continue;
      next[i]++;
      path.push(i);
      seeds--;
    }

    let capture = null;
    const landedOnOwnSide = ownPits(isPlayer).includes(i);
    const opposite = 12 - i;
    if (landedOnOwnSide && next[i] === 1 && next[opposite] > 0) {
      capture = { pit: i, opposite, amount: next[opposite] + 1 };
      next[myStore] += next[opposite] + 1;
      next[i] = 0;
      next[opposite] = 0;
    }

    const ended = sweepIfOver(next);
    return { board: next, extraTurn: i === myStore && !ended, path, capture, ended };
  }

  /** When either side is empty, the other side's seeds go to their owner's store. */
  function sweepIfOver(b) {
    const playerEmpty = ownPits(true).every((p) => b[p] === 0);
    const aiEmpty = ownPits(false).every((p) => b[p] === 0);
    if (!playerEmpty && !aiEmpty) return false;

    ownPits(true).forEach((p) => {
      b[PLAYER_STORE] += b[p];
      b[p] = 0;
    });
    ownPits(false).forEach((p) => {
      b[AI_STORE] += b[p];
      b[p] = 0;
    });
    return true;
  }

  /* ---------- Computer search (minimax + alpha-beta) ---------- */

  function evaluate(b) {
    return b[AI_STORE] - b[PLAYER_STORE];
  }

  function search(b, depth, aiToMove, alpha, beta) {
    const moves = validMoves(b, !aiToMove);
    if (depth === 0 || moves.length === 0) return evaluate(b);

    if (aiToMove) {
      let best = -Infinity;
      for (const m of moves) {
        const r = sow(b, m, false);
        // An extra turn keeps the same side moving without spending depth
        const val = r.ended
          ? evaluate(r.board) * 100
          : search(r.board, r.extraTurn ? depth : depth - 1, r.extraTurn, alpha, beta);
        best = Math.max(best, val);
        alpha = Math.max(alpha, val);
        if (beta <= alpha) break;
      }
      return best;
    }

    let best = Infinity;
    for (const m of moves) {
      const r = sow(b, m, true);
      const val = r.ended
        ? evaluate(r.board) * 100
        : search(r.board, r.extraTurn ? depth : depth - 1, !r.extraTurn, alpha, beta);
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return best;
  }

  function chooseAiMove() {
    const select = document.getElementById("mancala-difficulty");
    const depth = DEPTHS[select ? select.value : "medium"] || 3;
    const moves = validMoves(board, false);

    let bestVal = -Infinity;
    let bestMoves = [];
    moves.forEach((m) => {
      const r = sow(board, m, false);
      const val = r.ended
        ? evaluate(r.board) * 100
        : search(r.board, r.extraTurn ? depth : depth - 1, r.extraTurn, -Infinity, Infinity);
      if (val > bestVal) {
        bestVal = val;
        bestMoves = [m];
      } else if (val === bestVal) {
        bestMoves.push(m);
      }
    });
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  /* ---------- Game flow ---------- */

  function newGame() {
    clearTimeout(aiTimer);
    board = Array(14).fill(SEEDS);
    board[PLAYER_STORE] = 0;
    board[AI_STORE] = 0;
    playerTurn = true;
    animating = false;
    gameOver = false;
    hideOverlay();
    render();
    setStatus("Your move — pick a pit on the bottom row.");
  }

  function makeMove(pit, isPlayer) {
    if (animating || gameOver) return;
    if (isPlayer !== playerTurn || board[pit] === 0) return;
    if (!ownPits(isPlayer).includes(pit)) return;

    const result = sow(board, pit, isPlayer);
    animating = true;
    animateSow(pit, result, () => {
      animating = false;
      board = result.board;
      render();
      afterMove(result, isPlayer);
    });
  }

  function animateSow(pit, result, done) {
    const display = board.slice();
    display[pit] = 0;
    render(display);

    let step = 0;
    const tick = () => {
      if (step >= result.path.length) {
        setTimeout(done, 150);
        return;
      }
      const idx = result.path[step];
      display[idx]++;
      render(display, idx);
      tone(380 + step * 30, 0.04, "sine", 0.05);
      step++;
      setTimeout(tick, SOW_STEP_MS);
    };
    setTimeout(tick, SOW_STEP_MS);
  }

  function afterMove(result, isPlayer) {
    if (result.ended) {
      finishGame();
      return;
    }

    let note = "";
    if (result.capture) {
      note = `${isPlayer ? "You" : "Computer"} captured ${result.capture.amount} seeds! `;
      tone(660, 0.12, "triangle", 0.1);
      tone(880, 0.14, "triangle", 0.1, 0.1);
    }

    if (result.extraTurn) {
      note += isPlayer ? "Last seed in your store — go again!" : "Computer earned an extra turn.";
    } else {
      playerTurn = !isPlayer;
    }

    if (playerTurn) {
      setStatus(note + (result.extraTurn ? "" : "Your move."));
      render();
    } else {
      setStatus(note + (result.extraTurn ? "" : "Computer is thinking…"));
      render();
      aiTimer = setTimeout(() => makeMove(chooseAiMove(), false), 650);
    }
  }

  function finishGame() {
    gameOver = true;
    render();
    const you = board[PLAYER_STORE];
    const ai = board[AI_STORE];

    let title;
    if (you > ai) {
      stats.win++;
      title = "You Win! 🏆";
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.25, "triangle", 0.12, i * 0.08));
    } else if (ai > you) {
      stats.loss++;
      title = "Computer Wins";
      tone(220, 0.4, "sawtooth", 0.1);
    } else {
      title = "It's a Tie!";
      tone(330, 0.25, "sine", 0.1);
    }
    localStorage.setItem("mancala_stats", JSON.stringify(stats));
    render();
    setStatus("Game over.");
    showOverlay(title, `Final score — You ${you} : ${ai} Computer`);
  }

  /* ---------- Rendering ---------- */

  function render(display, flashIdx) {
    const b = display || board;

    document.querySelectorAll(".mancala-pit").forEach((pitEl) => {
      const idx = parseInt(pitEl.dataset.pit, 10);
      pitEl.textContent = b[idx];
      pitEl.classList.toggle("empty", b[idx] === 0);
      pitEl.classList.toggle("flash", idx === flashIdx);

      const canPlay = !display && !animating && !gameOver && playerTurn && idx <= 5 && b[idx] > 0;
      pitEl.classList.toggle("playable", canPlay);
      pitEl.disabled = !canPlay;
      pitEl.setAttribute("aria-label", `${idx <= 5 ? "Your" : "Computer"} pit with ${b[idx]} seeds`);
    });

    const playerStore = document.getElementById("mancala-store-player");
    const aiStore = document.getElementById("mancala-store-ai");
    if (playerStore) {
      playerStore.querySelector(".mancala-store-count").textContent = b[PLAYER_STORE];
      playerStore.classList.toggle("flash", flashIdx === PLAYER_STORE);
    }
    if (aiStore) {
      aiStore.querySelector(".mancala-store-count").textContent = b[AI_STORE];
      aiStore.classList.toggle("flash", flashIdx === AI_STORE);
    }

    const winsEl = document.getElementById("mancala-wins");
    const lossEl = document.getElementById("mancala-losses");
    if (winsEl) winsEl.textContent = stats.win;
    if (lossEl) lossEl.textContent = stats.loss;
  }

  function setStatus(text) {
    const el = document.getElementById("mancala-status");
    if (el) el.textContent = text;
  }

  function showOverlay(title, msg) {
    const overlay = document.getElementById("mancala-overlay");
    const titleEl = document.getElementById("mancala-overlay-title");
    const msgEl = document.getElementById("mancala-overlay-msg");
    if (!overlay) return;
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;
    overlay.classList.add("active");
  }

  function hideOverlay() {
    const overlay = document.getElementById("mancala-overlay");
    if (overlay) overlay.classList.remove("active");
  }

  // Initialize Controls
  document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("mancala-board")) return;

    document.querySelectorAll(".mancala-pit").forEach((pitEl) => {
      pitEl.addEventListener("click", () => makeMove(parseInt(pitEl.dataset.pit, 10), true));
    });

    const newBtn = document.getElementById("mancala-new-btn");
    const overlayBtn = document.getElementById("mancala-overlay-btn");
    if (newBtn) newBtn.addEventListener("click", newGame);
    if (overlayBtn) overlayBtn.addEventListener("click", newGame);

    newGame();
  });
})();
