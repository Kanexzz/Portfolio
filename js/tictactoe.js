/**
 * Tic-Tac-Toe vs AI (tictactoe.js)
 * Player (X) versus computer (O) with Easy / Medium / Hard (minimax) difficulty,
 * alternating first turn, persistent scoreboard, and Web Audio feedback.
 */

(function () {
  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  const HUMAN = "X";
  const AI = "O";

  let board = Array(9).fill(null);
  let isPlayerTurn = true;
  let playerStartsNext = true;
  let roundOver = false;
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
      const saved = JSON.parse(localStorage.getItem("ttt_stats") || "null");
      if (saved && typeof saved.win === "number") return saved;
    } catch (e) {
      // Corrupt storage falls back to zeros
    }
    return { win: 0, loss: 0, draw: 0 };
  }

  function saveStats() {
    localStorage.setItem("ttt_stats", JSON.stringify(stats));
  }

  function getWinner(b) {
    for (const [a, c, d] of LINES) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return { player: b[a], line: [a, c, d] };
    }
    if (b.every((v) => v)) return { player: "draw", line: [] };
    return null;
  }

  function minimax(b, isAiTurn, depth) {
    const result = getWinner(b);
    if (result) {
      if (result.player === AI) return 10 - depth;
      if (result.player === HUMAN) return depth - 10;
      return 0;
    }

    let best = isAiTurn ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = isAiTurn ? AI : HUMAN;
      const val = minimax(b, !isAiTurn, depth + 1);
      b[i] = null;
      best = isAiTurn ? Math.max(best, val) : Math.min(best, val);
    }
    return best;
  }

  function bestMove() {
    let bestVal = -Infinity;
    let moves = [];
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      board[i] = AI;
      const val = minimax(board, false, 0);
      board[i] = null;
      if (val > bestVal) {
        bestVal = val;
        moves = [i];
      } else if (val === bestVal) {
        moves.push(i);
      }
    }
    // Pick randomly among equally good moves so games don't repeat
    return moves[Math.floor(Math.random() * moves.length)];
  }

  function randomMove() {
    const empty = board.map((v, i) => (v ? null : i)).filter((i) => i !== null);
    return empty[Math.floor(Math.random() * empty.length)];
  }

  function chooseAiMove() {
    const select = document.getElementById("ttt-difficulty");
    const level = select ? select.value : "hard";
    if (level === "easy") return randomMove();
    if (level === "medium") return Math.random() < 0.55 ? bestMove() : randomMove();
    return bestMove();
  }

  function newRound() {
    clearTimeout(aiTimer);
    board = Array(9).fill(null);
    roundOver = false;
    isPlayerTurn = playerStartsNext;
    playerStartsNext = !playerStartsNext;
    render();

    if (isPlayerTurn) {
      setStatus("Your turn — you are <strong>X</strong>");
    } else {
      setStatus("Computer goes first…");
      scheduleAiMove();
    }
  }

  function scheduleAiMove() {
    clearTimeout(aiTimer);
    aiTimer = setTimeout(() => {
      if (roundOver) return;
      place(chooseAiMove(), AI);
    }, 420);
  }

  function place(index, mark) {
    if (roundOver || board[index]) return;
    board[index] = mark;
    tone(mark === HUMAN ? 520 : 380, 0.08, "triangle", 0.1);

    const result = getWinner(board);
    if (result) {
      finishRound(result);
      return;
    }

    isPlayerTurn = mark === AI;
    render();
    if (isPlayerTurn) {
      setStatus("Your turn — you are <strong>X</strong>");
    } else {
      setStatus("Computer is thinking…");
      scheduleAiMove();
    }
  }

  function finishRound(result) {
    roundOver = true;

    if (result.player === HUMAN) {
      stats.win++;
      setStatus("🎉 You win! Nicely played.");
      [523.25, 659.25, 783.99].forEach((f, i) => tone(f, 0.22, "triangle", 0.12, i * 0.09));
    } else if (result.player === AI) {
      stats.loss++;
      setStatus("🤖 Computer wins this round.");
      tone(220, 0.3, "sawtooth", 0.1);
    } else {
      stats.draw++;
      setStatus("🤝 It's a draw!");
      tone(330, 0.2, "sine", 0.1);
    }

    saveStats();
    render(result.line);
  }

  function setStatus(html) {
    const el = document.getElementById("ttt-status");
    if (el) el.innerHTML = html;
  }

  function render(winLine) {
    const cells = document.querySelectorAll("#ttt-board .ttt-cell");
    cells.forEach((cellEl, i) => {
      const val = board[i];
      cellEl.textContent = val || "";
      cellEl.className = "ttt-cell" + (val ? ` ttt-${val.toLowerCase()}` : "");
      if (winLine && winLine.includes(i)) cellEl.classList.add("ttt-win");
      cellEl.disabled = !!val || roundOver || !isPlayerTurn;
      cellEl.setAttribute("aria-label", `Cell ${i + 1}${val ? ": " + val : ""}`);
    });

    const winEl = document.getElementById("ttt-wins");
    const lossEl = document.getElementById("ttt-losses");
    const drawEl = document.getElementById("ttt-draws");
    if (winEl) winEl.textContent = stats.win;
    if (lossEl) lossEl.textContent = stats.loss;
    if (drawEl) drawEl.textContent = stats.draw;
  }

  // Initialize Controls
  document.addEventListener("DOMContentLoaded", () => {
    const boardEl = document.getElementById("ttt-board");
    if (!boardEl) return;

    for (let i = 0; i < 9; i++) {
      const cellBtn = document.createElement("button");
      cellBtn.type = "button";
      cellBtn.className = "ttt-cell";
      cellBtn.addEventListener("click", () => {
        if (isPlayerTurn) place(i, HUMAN);
      });
      boardEl.appendChild(cellBtn);
    }

    const newBtn = document.getElementById("ttt-new-btn");
    const resetBtn = document.getElementById("ttt-reset-btn");
    const select = document.getElementById("ttt-difficulty");

    if (newBtn) newBtn.addEventListener("click", newRound);
    if (select) select.addEventListener("change", newRound);
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        stats = { win: 0, loss: 0, draw: 0 };
        saveStats();
        render();
      });
    }

    newRound();
  });
})();
