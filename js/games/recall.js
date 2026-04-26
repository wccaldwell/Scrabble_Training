import { escapeHtml, formatTime } from "../leaderboard.js";

const byLengthThenAlpha = (a, b) => a.length - b.length || a.localeCompare(b);

export function renderRecallAnswers(week) {
  const sorted = [...new Set(week.answers.map(a => a.toUpperCase()))].sort(byLengthThenAlpha);
  const answersHtml = sorted
    .map(w => `<span class="answer found">${escapeHtml(w)}</span>`)
    .join(" ");
  const desc = week.description
    ? `<p class="muted" style="margin-top:0">${escapeHtml(week.description)}</p>`
    : "";
  return `${desc}<div class="review-puzzle"><div class="review-answers">${answersHtml}</div></div>`;
}

export function runRecallGame(root, week) {
  return new Promise(resolve => {
    const answerSet = new Set(week.answers.map(a => a.toUpperCase()));
    const sortedAnswers = [...answerSet].sort(byLengthThenAlpha);
    const penalty = Number(week.missPenaltySeconds) || 0;

    const state = {
      found: new Set(),
      misses: 0,
      startMs: Date.now(),
      timerId: null,
      finished: false
    };

    const total = answerSet.size;

    render();
    tickTimer();

    function tickTimer() {
      state.timerId = setInterval(() => {
        if (state.finished) return;
        const el = root.querySelector(".timer");
        if (el) el.textContent = formatTime(currentTime());
      }, 500);
    }

    function stopTimer() { if (state.timerId) clearInterval(state.timerId); }

    function elapsedSeconds() { return (Date.now() - state.startMs) / 1000; }
    function currentTime() { return elapsedSeconds() + state.misses * penalty; }

    function render() {
      const slotsHtml = sortedAnswers.map(w => {
        if (state.found.has(w)) {
          return `<span class="slot found">${escapeHtml(w)}</span>`;
        }
        const placeholder = "_".repeat(w.length);
        return `<span class="slot blank" aria-label="unfilled slot">${placeholder}</span>`;
      }).join("");
      const description = week.description
        ? `<p class="muted" style="margin-top:0">${escapeHtml(week.description)}</p>`
        : "";
      const penaltyNote = penalty > 0
        ? `<span class="muted"> · each miss adds ${penalty}s</span>`
        : "";

      const msgText = root.dataset.lastMsg || "";
      const msgKind = root.dataset.lastMsgKind || "";

      root.innerHTML = `
        <div class="card">
          <div class="game-status">
            <span><strong>${state.found.size}</strong> of ${total} found${penaltyNote}</span>
            <span class="timer">${formatTime(currentTime())}</span>
          </div>
          ${description}
          <div class="message ${escapeHtml(msgKind)}" id="msg">${escapeHtml(msgText)}</div>
          <form class="guess-row" id="guess-form" autocomplete="off">
            <input type="text" id="guess-input" placeholder="Type a word" autocomplete="off" autocapitalize="characters" spellcheck="false" />
            <button type="submit">Enter</button>
          </form>
          <div class="muted" style="text-align:center;font-size:13px">Misses: ${state.misses}${penalty > 0 ? ` (+${formatTime(state.misses * penalty)} penalty)` : ""}</div>
          <div class="slot-grid">${slotsHtml}</div>
          <div class="game-actions">
            <button type="button" id="giveup-btn">Give Up</button>
          </div>
        </div>
      `;

      const input = root.querySelector("#guess-input");
      input?.focus({ preventScroll: true });
      root.querySelector("#guess-form").addEventListener("submit", onGuess);
      root.querySelector("#giveup-btn").addEventListener("click", onGiveUp);
    }

    function onGuess(e) {
      e.preventDefault();
      const input = root.querySelector("#guess-input");
      const raw = (input.value || "").trim().toUpperCase().replace(/\s+/g, "");
      if (!raw) return;

      if (state.found.has(raw)) {
        flash("Already found.", "");
      } else if (answerSet.has(raw)) {
        state.found.add(raw);
        flash(`✓ ${raw}`, "ok");
        if (state.found.size >= total) {
          input.value = "";
          finish();
          return;
        }
      } else {
        state.misses++;
        flash(penalty > 0 ? `✗ Incorrect (+${penalty}s)` : `✗ Incorrect`, "bad");
      }
      input.value = "";
      render();
    }

    function onGiveUp() {
      if (!confirm("Give up now? Your score will be recorded.")) return;
      finish();
    }

    function flash(text, kind) {
      // Stash so we can re-insert after render.
      root.dataset.lastMsg = text;
      root.dataset.lastMsgKind = kind || "";
    }

    function finish() {
      state.finished = true;
      stopTimer();
      const timeSeconds = Math.round(elapsedSeconds());
      const penaltySeconds = state.misses * penalty;
      const result = {
        correct: state.found.size,
        total,
        timeSeconds,
        penaltySeconds
      };
      renderReview(result);
      resolve(result);
    }

    function renderReview({ correct, total, timeSeconds, penaltySeconds }) {
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      const sorted = [...answerSet].sort(byLengthThenAlpha);
      const answersHtml = sorted.map(w => {
        const cls = state.found.has(w) ? "found" : "missed";
        return `<span class="answer ${cls}">${escapeHtml(w)}</span>`;
      }).join(" ");
      const penaltyLine = penaltySeconds > 0
        ? `<div class="muted">Time: ${formatTime(timeSeconds)} · Penalties: +${formatTime(penaltySeconds)} · Total: ${formatTime(timeSeconds + penaltySeconds)}</div>`
        : `<div class="muted">Time: ${formatTime(timeSeconds)}</div>`;

      root.innerHTML = `
        <div class="card">
          <h2>Review</h2>
          <p class="review-summary">You got <strong>${correct}</strong> of <strong>${total}</strong> (${pct}%) with <strong>${state.misses}</strong> miss${state.misses === 1 ? "" : "es"}.</p>
          ${penaltyLine}
          <div class="review-puzzle">
            <div class="review-answers">${answersHtml}</div>
          </div>
        </div>
      `;
    }
  });
}
