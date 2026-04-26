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
    let els = null;

    render();
    tickTimer();

    function tickTimer() {
      state.timerId = setInterval(() => {
        if (state.finished) return;
        if (els?.timer) els.timer.textContent = formatTime(currentTime());
      }, 500);
    }

    function stopTimer() { if (state.timerId) clearInterval(state.timerId); }

    function elapsedSeconds() { return (Date.now() - state.startMs) / 1000; }
    function currentTime() { return elapsedSeconds() + state.misses * penalty; }

    function missesText() {
      return `Misses: ${state.misses}${penalty > 0 ? ` (+${formatTime(state.misses * penalty)} penalty)` : ""}`;
    }

    function slotHtml(w) {
      const placeholder = "_".repeat(w.length);
      return `<span class="slot blank" data-word="${w}" aria-label="unfilled slot">${placeholder}</span>`;
    }

    function render() {
      const slotsHtml = sortedAnswers.map(slotHtml).join("");
      const description = week.description
        ? `<p class="muted" style="margin-top:0">${escapeHtml(week.description)}</p>`
        : "";
      const penaltyNote = penalty > 0
        ? `<span class="muted"> · each miss adds ${penalty}s</span>`
        : "";

      root.innerHTML = `
        <div class="card recall-card">
          <div class="recall-input-wrap">
            <div class="game-status">
              <span><strong id="found-count">${state.found.size}</strong> of ${total} found${penaltyNote}</span>
              <span class="timer">${formatTime(currentTime())}</span>
            </div>
            <form class="guess-row" id="guess-form" autocomplete="off">
              <input type="text" id="guess-input" placeholder="Type a word" autocomplete="off" autocapitalize="characters" spellcheck="false" />
              <button type="submit">Enter</button>
            </form>
            <div class="recall-input-foot">
              <span class="muted" style="font-size:13px" id="misses-line">${missesText()}</span>
              <span class="message" id="msg"></span>
            </div>
          </div>
          ${description}
          <div class="slot-grid" id="slot-grid">${slotsHtml}</div>
          <div class="game-actions">
            <button type="button" id="giveup-btn">Give Up</button>
          </div>
        </div>
      `;

      els = {
        foundCount: root.querySelector("#found-count"),
        msg: root.querySelector("#msg"),
        input: root.querySelector("#guess-input"),
        missesLine: root.querySelector("#misses-line"),
        slotGrid: root.querySelector("#slot-grid"),
        timer: root.querySelector(".timer")
      };

      els.input?.focus({ preventScroll: true });
      root.querySelector("#guess-form").addEventListener("submit", onGuess);
      root.querySelector("#giveup-btn").addEventListener("click", onGiveUp);
    }

    function flash(text, kind) {
      if (!els?.msg) return;
      els.msg.className = `message ${kind || ""}`;
      els.msg.textContent = text;
    }

    function markFound(word) {
      if (!els) return;
      const slot = els.slotGrid.querySelector(`.slot[data-word="${word}"]`);
      if (slot) {
        slot.className = "slot found";
        slot.removeAttribute("aria-label");
        slot.textContent = word;
      }
      if (els.foundCount) els.foundCount.textContent = state.found.size;
    }

    function updateMisses() {
      if (els?.missesLine) els.missesLine.textContent = missesText();
    }

    function onGuess(e) {
      e.preventDefault();
      const input = els.input;
      const raw = (input.value || "").trim().toUpperCase().replace(/\s+/g, "");
      input.value = "";
      if (!raw) return;

      if (state.found.has(raw)) {
        flash("Already found.", "");
      } else if (answerSet.has(raw)) {
        state.found.add(raw);
        markFound(raw);
        flash(`✓ ${raw}`, "ok");
        if (state.found.size >= total) {
          finish();
          return;
        }
      } else {
        state.misses++;
        updateMisses();
        flash(penalty > 0 ? `✗ Incorrect (+${penalty}s)` : `✗ Incorrect`, "bad");
      }
    }

    function onGiveUp() {
      if (!confirm("Give up now? Your score will be recorded.")) return;
      finish();
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
