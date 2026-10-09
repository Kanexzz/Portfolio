/**
 * Hearts (hearts.js)
 * Classic 4-player Hearts vs three computer opponents: card passing (left / right /
 * across / hold), follow-suit rules, hearts breaking, Queen of Spades, shooting the
 * moon, and a game played to 100 points. Lowest total wins.
 */

(function () {
  const SUITS = ["♣", "♦", "♠", "♥"]; // also the hand sort order
  const RANK_LABELS = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  const SEAT_NAMES = ["You", "West", "North", "East"];
  const PASS_DIRS = [
    { offset: 1, label: "left" },
    { offset: 3, label: "right" },
    { offset: 2, label: "across" },
    null // hold hand
  ];
  const GAME_OVER_SCORE = 100;
  const AI_DELAY = 550;
  const TRICK_PAUSE = 1000;

  let hands = [[], [], [], []];
  let handPoints = [0, 0, 0, 0];
  let totals = [0, 0, 0, 0];
  let handNumber = 0;
  let phase = "pass"; // pass | play | trick-end | hand-over | game-over
  let trick = []; // [{ seat, card }]
  let turn = 0;
  let heartsBroken = false;
  let firstTrick = true;
  let selectedPass = [];
  let pendingTimer = null;

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

  /* ---------- Card helpers ---------- */

  function cardId(c) {
    return c.suit + c.rank;
  }

  function isQueenOfSpades(c) {
    return c.suit === "♠" && c.rank === 12;
  }

  function cardPoints(c) {
    if (c.suit === "♥") return 1;
    if (isQueenOfSpades(c)) return 13;
    return 0;
  }

  function sortHand(hand) {
    hand.sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || a.rank - b.rank);
  }

  function deal() {
    const deck = [];
    SUITS.forEach((suit) => {
      for (let rank = 2; rank <= 14; rank++) deck.push({ suit, rank });
    });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    hands = [0, 1, 2, 3].map((s) => deck.slice(s * 13, s * 13 + 13));
    hands.forEach(sortHand);
  }

  function removeCard(seat, card) {
    hands[seat] = hands[seat].filter((c) => cardId(c) !== cardId(card));
  }

  /* ---------- Rules ---------- */

  function legalMoves(seat) {
    const hand = hands[seat];

    if (trick.length === 0) {
      if (firstTrick) return hand.filter((c) => c.suit === "♣" && c.rank === 2);
      if (!heartsBroken) {
        const nonHearts = hand.filter((c) => c.suit !== "♥");
        if (nonHearts.length) return nonHearts;
      }
      return hand.slice();
    }

    const leadSuit = trick[0].card.suit;
    const follow = hand.filter((c) => c.suit === leadSuit);
    if (follow.length) return follow;

    // Void in the led suit: no points may be dumped on the first trick if avoidable
    if (firstTrick) {
      const safe = hand.filter((c) => cardPoints(c) === 0);
      if (safe.length) return safe;
    }
    return hand.slice();
  }

  function trickWinner() {
    const leadSuit = trick[0].card.suit;
    let best = trick[0];
    trick.forEach((t) => {
      if (t.card.suit === leadSuit && t.card.rank > best.card.rank) best = t;
    });
    return best.seat;
  }

  /* ---------- Computer strategy ---------- */

  function aiChoosePass(seat) {
    const danger = (c) => {
      if (isQueenOfSpades(c)) return 100;
      if (c.suit === "♠" && c.rank > 12) return 90 + c.rank;
      if (c.suit === "♥") return 20 + c.rank;
      return c.rank;
    };
    return hands[seat]
      .slice()
      .sort((a, b) => danger(b) - danger(a))
      .slice(0, 3);
  }

  function aiChooseCard(seat) {
    const legal = legalMoves(seat).sort((a, b) => a.rank - b.rank);
    if (legal.length === 1) return legal[0];

    const withoutQueen = legal.filter((c) => !isQueenOfSpades(c));
    const lowest = (cards) => cards[0];
    const highest = (cards) => cards[cards.length - 1];

    // Leading: low card, never lead high spades if there's an alternative
    if (trick.length === 0) {
      const safeLeads = legal.filter((c) => !(c.suit === "♠" && c.rank >= 12));
      return lowest(safeLeads.length ? safeLeads : legal);
    }

    const leadSuit = trick[0].card.suit;
    const following = legal[0].suit === leadSuit;

    if (following) {
      const winningRank = Math.max(...trick.filter((t) => t.card.suit === leadSuit).map((t) => t.card.rank));
      const queen = legal.find(isQueenOfSpades);
      // Someone already played A/K of spades: drop the Queen on them
      if (queen && winningRank > 12) return queen;

      const ducks = legal.filter((c) => c.rank < winningRank);
      if (ducks.length) return highest(ducks);

      const trickHasPoints = trick.some((t) => cardPoints(t.card) > 0);
      const isLast = trick.length === 3;
      const pool = withoutQueen.length ? withoutQueen : legal;
      // Forced to win: if it's clean and we're last, shed the biggest card
      return isLast && !trickHasPoints ? highest(pool) : lowest(pool);
    }

    // Void: unload the most dangerous card
    const queen = legal.find(isQueenOfSpades);
    if (queen) return queen;
    const hearts = legal.filter((c) => c.suit === "♥");
    if (hearts.length) return highest(hearts);
    return legal.reduce((a, b) => (b.rank > a.rank ? b : a));
  }

  /* ---------- Game flow ---------- */

  function newGame() {
    clearTimeout(pendingTimer);
    totals = [0, 0, 0, 0];
    handNumber = 0;
    hideOverlay();
    startHand();
  }

  function startHand() {
    clearTimeout(pendingTimer);
    deal();
    handPoints = [0, 0, 0, 0];
    trick = [];
    heartsBroken = false;
    firstTrick = true;
    selectedPass = [];

    const dir = PASS_DIRS[handNumber % 4];
    if (dir) {
      phase = "pass";
      setStatus(`Choose 3 cards to pass <strong>${dir.label}</strong>.`);
      render();
    } else {
      setStatus("Hold hand — no passing this round.");
      beginPlay();
    }
  }

  function confirmPass() {
    if (phase !== "pass" || selectedPass.length !== 3) return;
    const dir = PASS_DIRS[handNumber % 4];

    const outgoing = [selectedPass.slice(), aiChoosePass(1), aiChoosePass(2), aiChoosePass(3)];
    outgoing.forEach((cards, seat) => cards.forEach((c) => removeCard(seat, c)));
    outgoing.forEach((cards, seat) => {
      const target = (seat + dir.offset) % 4;
      hands[target].push(...cards);
    });
    hands.forEach(sortHand);

    const fromSeat = (4 - dir.offset) % 4;
    const received = outgoing[fromSeat].map(cardLabel).join("  ");
    selectedPass = [];
    tone(500, 0.1, "triangle", 0.08);
    setStatus(`${SEAT_NAMES[fromSeat]} passed you: <strong>${received}</strong>`);
    beginPlay();
  }

  function beginPlay() {
    phase = "play";
    turn = hands.findIndex((h) => h.some((c) => c.suit === "♣" && c.rank === 2));
    render();
    pendingTimer = setTimeout(nextTurn, turn === 0 ? 0 : 900);
  }

  function nextTurn() {
    if (phase !== "play") return;

    if (trick.length === 4) {
      resolveTrick();
      return;
    }

    render();
    if (turn === 0) {
      if (trick.length === 0 && firstTrick) setStatus("You have the 2♣ — lead it to start.");
      else if (trick.length === 0) setStatus("Your lead.");
      else setStatus("Your turn.");
    } else {
      setStatus(`${SEAT_NAMES[turn]} is playing…`);
      pendingTimer = setTimeout(() => playCard(turn, aiChooseCard(turn)), AI_DELAY);
    }
  }

  function playCard(seat, card) {
    if (phase !== "play" || seat !== turn) return;
    if (!legalMoves(seat).some((c) => cardId(c) === cardId(card))) return;

    removeCard(seat, card);
    trick.push({ seat, card });
    if (card.suit === "♥" && !heartsBroken) {
      heartsBroken = true;
      if (trick.length > 1) setStatus("💔 Hearts have been broken!");
    }
    tone(seat === 0 ? 440 : 360, 0.05, "sine", 0.06);

    turn = (turn + 1) % 4;
    render();
    nextTurn();
  }

  function resolveTrick() {
    phase = "trick-end";
    const winner = trickWinner();
    const points = trick.reduce((sum, t) => sum + cardPoints(t.card), 0);
    handPoints[winner] += points;

    render(winner);
    const who = winner === 0 ? "You take" : `${SEAT_NAMES[winner]} takes`;
    setStatus(`${who} the trick${points ? ` (+${points})` : ""}.`);
    if (points >= 13) tone(180, 0.35, "sawtooth", 0.1);

    pendingTimer = setTimeout(() => {
      trick = [];
      firstTrick = false;
      turn = winner;
      if (hands[0].length === 0) {
        endHand();
      } else {
        phase = "play";
        nextTurn();
      }
    }, TRICK_PAUSE);
  }

  function endHand() {
    const shooter = handPoints.indexOf(26);
    let summary;
    if (shooter !== -1) {
      handPoints = handPoints.map((_, s) => (s === shooter ? 0 : 26));
      summary = shooter === 0 ? "🌙 You shot the moon! Everyone else takes 26." : `🌙 ${SEAT_NAMES[shooter]} shot the moon!`;
    } else {
      summary = `You took ${handPoints[0]} point${handPoints[0] === 1 ? "" : "s"} this hand.`;
    }

    totals = totals.map((t, s) => t + handPoints[s]);
    handNumber++;

    if (Math.max(...totals) >= GAME_OVER_SCORE) {
      phase = "game-over";
      const low = Math.min(...totals);
      const winners = totals.map((t, s) => (t === low ? SEAT_NAMES[s] : null)).filter(Boolean);
      const youWon = totals[0] === low;
      if (youWon) {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.25, "triangle", 0.12, i * 0.08));
      } else {
        tone(220, 0.4, "sawtooth", 0.1);
      }
      render();
      showOverlay(
        youWon ? "You Win! 🏆" : "Game Over",
        `${summary} Final low score: ${low} (${winners.join(", ")}).`,
        "New Game"
      );
    } else {
      phase = "hand-over";
      render();
      showOverlay("Hand Complete", summary, "Next Hand");
    }
  }

  /* ---------- Rendering ---------- */

  function cardLabel(c) {
    return (RANK_LABELS[c.rank] || c.rank) + c.suit;
  }

  function createCardEl(card, tag) {
    const el = document.createElement(tag || "div");
    el.className = "hearts-card" + (card.suit === "♥" || card.suit === "♦" ? " red" : "");
    el.innerHTML =
      `<span class="hearts-card-rank">${RANK_LABELS[card.rank] || card.rank}</span>` +
      `<span class="hearts-card-suit">${card.suit}</span>`;
    el.setAttribute("aria-label", cardLabel(card));
    return el;
  }

  function render(winnerSeat) {
    // Opponent seats
    [1, 2, 3].forEach((seat) => {
      const seatEl = document.getElementById(`hearts-seat-${seat}`);
      if (!seatEl) return;
      seatEl.classList.toggle("active", phase === "play" && turn === seat);
      const meta = seatEl.querySelector(".hearts-seat-meta");
      if (meta) meta.textContent = `${hands[seat].length} cards · ${handPoints[seat]} pts`;
    });

    // Trick slots
    document.querySelectorAll(".hearts-trick-slot").forEach((slot) => {
      slot.innerHTML = "";
      const seat = parseInt(slot.dataset.seat, 10);
      const played = trick.find((t) => t.seat === seat);
      if (played) {
        const el = createCardEl(played.card);
        if (seat === winnerSeat) el.classList.add("winner");
        slot.appendChild(el);
      }
    });

    // Player hand
    const handEl = document.getElementById("hearts-hand");
    if (handEl) {
      handEl.innerHTML = "";
      const legalIds =
        phase === "play" && turn === 0 ? legalMoves(0).map(cardId) : [];

      hands[0].forEach((card) => {
        const btn = createCardEl(card, "button");
        btn.type = "button";
        const id = cardId(card);

        if (phase === "pass") {
          btn.classList.add("legal");
          if (selectedPass.some((c) => cardId(c) === id)) btn.classList.add("selected");
          btn.addEventListener("click", () => togglePassCard(card));
        } else if (legalIds.includes(id)) {
          btn.classList.add("legal");
          btn.addEventListener("click", () => playCard(0, card));
        } else {
          btn.disabled = true;
        }
        handEl.appendChild(btn);
      });
    }

    // Pass button
    const passBtn = document.getElementById("hearts-pass-btn");
    if (passBtn) {
      passBtn.style.display = phase === "pass" ? "inline-flex" : "none";
      passBtn.disabled = selectedPass.length !== 3;
      passBtn.textContent = `Pass ${selectedPass.length}/3`;
    }

    // Scoreboard
    for (let s = 0; s < 4; s++) {
      const handCell = document.getElementById(`hearts-hand-pts-${s}`);
      const totalCell = document.getElementById(`hearts-total-${s}`);
      if (handCell) handCell.textContent = handPoints[s];
      if (totalCell) totalCell.textContent = totals[s];
    }
  }

  function togglePassCard(card) {
    const id = cardId(card);
    if (selectedPass.some((c) => cardId(c) === id)) {
      selectedPass = selectedPass.filter((c) => cardId(c) !== id);
    } else if (selectedPass.length < 3) {
      selectedPass.push(card);
    }
    render();
  }

  function setStatus(html) {
    const el = document.getElementById("hearts-status");
    if (el) el.innerHTML = html;
  }

  function showOverlay(title, msg, btnText) {
    const overlay = document.getElementById("hearts-overlay");
    const titleEl = document.getElementById("hearts-overlay-title");
    const msgEl = document.getElementById("hearts-overlay-msg");
    const btn = document.getElementById("hearts-overlay-btn");
    if (!overlay) return;
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = msg;
    if (btn) btn.textContent = btnText;
    overlay.classList.add("active");
  }

  function hideOverlay() {
    const overlay = document.getElementById("hearts-overlay");
    if (overlay) overlay.classList.remove("active");
  }

  // Initialize Controls
  document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("hearts-hand")) return;

    const newBtn = document.getElementById("hearts-new-btn");
    const passBtn = document.getElementById("hearts-pass-btn");
    const overlayBtn = document.getElementById("hearts-overlay-btn");

    if (newBtn) newBtn.addEventListener("click", newGame);
    if (passBtn) passBtn.addEventListener("click", confirmPass);
    if (overlayBtn) {
      overlayBtn.addEventListener("click", () => {
        hideOverlay();
        if (phase === "game-over") newGame();
        else startHand();
      });
    }

    newGame();
  });
})();
