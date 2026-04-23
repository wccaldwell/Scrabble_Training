import { escapeHtml, formatTime } from "../leaderboard.js";

export function renderAnagramAnswers(week) {
  return week.puzzles.map(p => {
    const tiles = [...p.scramble.toUpperCase()].join(" ");
    const answers = p.answers
      .map(a => `<span class="answer found">${escapeHtml(a.toUpperCase())}</span>`)
      .join(" ");
    return `
      <div class="review-puzzle">
        <h3>${escapeHtml(tiles)} <span class="muted" style="font-size:14px;font-weight:400">· ${p.answers.length} valid</span></h3>
        <div class="review-answers">${answers}</div>
      </div>
    `;
  }).join("");
}

export function runAnagramGame(root, week) {
  return new Promise(resolve => {
    const state = {
      puzzles: week.puzzles.map(p => ({
        scramble: p.scramble.toUpperCase(),
        answers: p.answers.map(a => a.toUpperCase()),
        found: new Set(),
        locked: false
      })),
      index: 0,
      startMs: Date.now(),
      timerId: null
    };

    const total = state.puzzles.reduce((s, p) => s + p.answers.length, 0);
    const correct = () => state.puzzles.reduce((s, p) => s + p.found.size, 0);

    // Start on first active puzzle (should be puzzle 0 on a fresh game).
    state.index = firstActive(state);
    renderCard();
    tickTimer();

    function tickTimer() {
      state.timerId = setInterval(() => {
        const el = root.querySelector(".timer");
        if (el) el.textContent = formatTime((Date.now() - state.startMs) / 1000);
      }, 500);
    }

    function stopTimer() {
      if (state.timerId) clearInterval(state.timerId);
    }

    function elapsed() {
      return (Date.now() - state.startMs) / 1000;
    }

    function firstActive(s) {
      const i = s.puzzles.findIndex(p => !p.locked && p.found.size < p.answers.length);
      return i === -1 ? 0 : i;
    }

    function nextActive(s, from) {
      const n = s.puzzles.length;
      for (let step = 1; step <= n; step++) {
        const i = (from + step) % n;
        const p = s.puzzles[i];
        if (!p.locked && p.found.size < p.answers.length) return i;
      }
      return -1; // none left
    }

    function anyActive(s) {
      return s.puzzles.some(p => !p.locked && p.found.size < p.answers.length);
    }

    function renderCard() {
      const p = state.puzzles[state.index];
      const tiles = [...p.scramble].map(ch => `<span class="tile">${ch}</span>`).join("");
      const foundHtml = [...p.found].map(a => `<span class="found">${escapeHtml(a)}</span>`).join("");
      const progressLabel = `Puzzle ${state.index + 1} of ${state.puzzles.length}`;
      const countLabel = `${p.answers.length} valid ${p.answers.length === 1 ? "word" : "words"}`;
      const initialTime = formatTime(elapsed());

      root.innerHTML = `
        <div class="card">
          <div class="game-status">
            <span>${progressLabel} · ${countLabel}</span>
            <span class="timer">${initialTime}</span>
          </div>
          <div class="tile-row">${tiles}</div>
          <div class="message" id="msg"></div>
          <form class="guess-row" id="guess-form" autocomplete="off">
            <input type="text" id="guess-input" placeholder="Your guess" autocomplete="off" autocapitalize="characters" spellcheck="false" ${p.locked ? "disabled" : ""} />
            <button type="submit" ${p.locked ? "disabled" : ""}>Submit</button>
          </form>
          <div class="found-list">${foundHtml}</div>
          <div class="game-actions">
            <button type="button" class="secondary" id="skip-btn">Skip</button>
            <button type="button" id="giveup-btn">Give Up</button>
          </div>
        </div>
      `;

      const input = root.querySelector("#guess-input");
      input?.focus();

      root.querySelector("#guess-form").addEventListener("submit", onGuess);
      root.querySelector("#skip-btn").addEventListener("click", onSkip);
      root.querySelector("#giveup-btn").addEventListener("click", onGiveUp);
    }

    function onGuess(e) {
      e.preventDefault();
      const p = state.puzzles[state.index];
      if (p.locked) return;
      const input = root.querySelector("#guess-input");
      const raw = (input.value || "").trim().toUpperCase().replace(/\s+/g, "");
      if (!raw) return;

      if (p.found.has(raw)) {
        flashMessage("Already found.", "");
        input.value = "";
        return;
      }
      if (p.answers.includes(raw)) {
        p.found.add(raw);
        flashMessage(`✓ ${raw}`, "ok");
        input.value = "";
        if (p.found.size >= p.answers.length) {
          // Fully solved — auto-advance.
          advanceOrFinish();
        } else {
          renderCard();
        }
        return;
      }
      // Wrong guess → lock.
      p.locked = true;
      flashMessage(`✗ Incorrect`, "bad");
      setTimeout(() => advanceOrFinish(), 700);
    }

    function onSkip() {
      if (!anyActive(state)) return finish();
      const next = nextActive(state, state.index);
      if (next === -1) return finish();
      state.index = next;
      renderCard();
    }

    function onGiveUp() {
      if (!confirm("Give up now? Your score will be recorded.")) return;
      finish();
    }

    function advanceOrFinish() {
      if (!anyActive(state)) return finish();
      const next = nextActive(state, state.index);
      if (next === -1) return finish();
      state.index = next;
      renderCard();
    }

    function flashMessage(text, kind) {
      const el = root.querySelector("#msg");
      if (!el) return;
      el.textContent = text;
      el.className = `message ${kind}`;
    }

    function finish() {
      stopTimer();
      const timeSeconds = Math.round(elapsed());
      const result = {
        correct: correct(),
        total,
        timeSeconds,
        penaltySeconds: 0
      };
      renderReview(result);
      resolve(result);
    }

    function renderReview({ correct: c, total: t, timeSeconds }) {
      const pct = t > 0 ? Math.round((c / t) * 100) : 0;
      const puzzleBlocks = state.puzzles.map((p, i) => {
        const answersHtml = p.answers.map(a => {
          const cls = p.found.has(a) ? "found" : "missed";
          return `<span class="answer ${cls}">${escapeHtml(a)}</span>`;
        }).join("");
        const tiles = [...p.scramble].join(" ");
        return `
          <div class="review-puzzle">
            <h3>${escapeHtml(tiles)} <span class="muted" style="font-size:14px;font-weight:400">· ${p.found.size}/${p.answers.length}</span></h3>
            <div class="review-answers">${answersHtml}</div>
          </div>
        `;
      }).join("");

      root.innerHTML = `
        <div class="card">
          <h2>Review</h2>
          <p class="review-summary">You got <strong>${c}</strong> of <strong>${t}</strong> (${pct}%) in <strong>${formatTime(timeSeconds)}</strong>.</p>
          ${puzzleBlocks}
        </div>
      `;
    }
  });
}
