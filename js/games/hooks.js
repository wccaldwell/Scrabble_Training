import { escapeHtml, formatTime } from "../leaderboard.js";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function renderHooksAnswers(week) {
  return week.puzzles.map(p => {
    const word = p.word.toUpperCase();
    const front = (p.front || []).map(l => l.toUpperCase()).sort();
    const back = (p.back || []).map(l => l.toUpperCase()).sort();
    const frontHtml = front.length
      ? front.map(l => `<span class="answer found">${escapeHtml(l)}</span>`).join(" ")
      : `<span class="muted">(none)</span>`;
    const backHtml = back.length
      ? back.map(l => `<span class="answer found">${escapeHtml(l)}</span>`).join(" ")
      : `<span class="muted">(none)</span>`;
    return `
      <div class="review-puzzle">
        <h3>${escapeHtml(word)}</h3>
        <div><span class="muted">Front:</span> ${frontHtml}</div>
        <div style="margin-top:6px"><span class="muted">Back:</span> ${backHtml}</div>
      </div>
    `;
  }).join("");
}

export function runHooksGame(root, week) {
  return new Promise(resolve => {
    const state = {
      puzzles: week.puzzles.map(p => ({
        word: p.word.toUpperCase(),
        validFront: new Set((p.front || []).map(l => l.toUpperCase())),
        validBack: new Set((p.back || []).map(l => l.toUpperCase())),
        selectedFront: new Set(),
        selectedBack: new Set(),
        submitted: false
      })),
      index: 0,
      startMs: Date.now(),
      timerId: null
    };

    const total = state.puzzles.reduce((s, p) => s + p.validFront.size + p.validBack.size, 0);
    const correct = () =>
      state.puzzles.reduce((s, p) => {
        if (!p.submitted) return s;
        let c = 0;
        p.selectedFront.forEach(l => { if (p.validFront.has(l)) c++; });
        p.selectedBack.forEach(l => { if (p.validBack.has(l)) c++; });
        return s + c;
      }, 0);

    state.index = firstPending();
    renderCard();
    tickTimer();

    function tickTimer() {
      state.timerId = setInterval(() => {
        const el = root.querySelector(".timer");
        if (el) el.textContent = formatTime((Date.now() - state.startMs) / 1000);
      }, 500);
    }
    function stopTimer() { if (state.timerId) clearInterval(state.timerId); }
    function elapsed() { return (Date.now() - state.startMs) / 1000; }

    function firstPending() {
      const i = state.puzzles.findIndex(p => !p.submitted);
      return i === -1 ? 0 : i;
    }
    function nextPending(from) {
      const n = state.puzzles.length;
      for (let step = 1; step <= n; step++) {
        const i = (from + step) % n;
        if (!state.puzzles[i].submitted) return i;
      }
      return -1;
    }
    function anyPending() { return state.puzzles.some(p => !p.submitted); }

    function renderCard() {
      const p = state.puzzles[state.index];
      const hookCount = p.validFront.size + p.validBack.size;
      const progressLabel = `Word ${state.index + 1} of ${state.puzzles.length}`;
      const countLabel = `${hookCount} valid ${hookCount === 1 ? "hook" : "hooks"}`;
      const initialTime = formatTime(elapsed());

      root.innerHTML = `
        <div class="card">
          <div class="game-status">
            <span>${progressLabel} · ${countLabel}</span>
            <span class="timer">${initialTime}</span>
          </div>
          <div class="message" id="msg"></div>
          <div class="hooks-playfield">
            <div class="hooks-col">
              <div class="hooks-label muted">Front</div>
              <div class="hooks-grid" data-side="front">${letterButtons(p, "front")}</div>
            </div>
            <div class="hook-word">${escapeHtml(p.word)}</div>
            <div class="hooks-col">
              <div class="hooks-label muted">Back</div>
              <div class="hooks-grid" data-side="back">${letterButtons(p, "back")}</div>
            </div>
          </div>
          <div class="game-actions">
            ${p.submitted
              ? `<button type="button" id="next-btn">${anyPending() ? "Next word" : "Finish"}</button>`
              : `<button type="button" id="submit-btn">Submit</button>`}
            <button type="button" class="secondary" id="skip-btn" ${p.submitted ? "disabled" : ""}>Skip</button>
            <button type="button" id="giveup-btn">Give Up</button>
          </div>
        </div>
      `;

      wireHandlers();
    }

    function letterButtons(p, side) {
      const selected = side === "front" ? p.selectedFront : p.selectedBack;
      const valid = side === "front" ? p.validFront : p.validBack;
      return ALPHA.map(letter => {
        const isSelected = selected.has(letter);
        const isValid = valid.has(letter);
        let cls = "hook-btn";
        if (p.submitted) {
          if (isSelected && isValid) cls += " correct";
          else if (isSelected && !isValid) cls += " incorrect";
          else if (!isSelected && isValid) cls += " missed";
          else cls += " dim";
        } else if (isSelected) {
          cls += " selected";
        }
        return `<button type="button" class="${cls}" data-letter="${letter}" data-side="${side}" ${p.submitted ? "disabled" : ""}>${letter}</button>`;
      }).join("");
    }

    function wireHandlers() {
      root.querySelectorAll(".hook-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const p = state.puzzles[state.index];
          if (p.submitted) return;
          const letter = btn.dataset.letter;
          const side = btn.dataset.side;
          const set = side === "front" ? p.selectedFront : p.selectedBack;
          if (set.has(letter)) set.delete(letter); else set.add(letter);
          renderCard();
        });
      });

      const submitBtn = root.querySelector("#submit-btn");
      submitBtn?.addEventListener("click", () => {
        const p = state.puzzles[state.index];
        p.submitted = true;
        renderCard();
      });

      const nextBtn = root.querySelector("#next-btn");
      nextBtn?.addEventListener("click", () => {
        if (!anyPending()) return finish();
        const next = nextPending(state.index);
        if (next === -1) return finish();
        state.index = next;
        renderCard();
      });

      root.querySelector("#skip-btn")?.addEventListener("click", () => {
        if (!anyPending()) return finish();
        const next = nextPending(state.index);
        if (next === -1) return finish();
        state.index = next;
        renderCard();
      });

      root.querySelector("#giveup-btn")?.addEventListener("click", () => {
        if (!confirm("Give up now? Your score will be recorded.")) return;
        finish();
      });
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
      const blocks = state.puzzles.map(p => {
        const frontHtml = reviewSide(p.validFront, p.selectedFront);
        const backHtml = reviewSide(p.validBack, p.selectedBack);
        const wrongPicks = [
          ...[...p.selectedFront].filter(l => !p.validFront.has(l)).map(l => l + " (front)"),
          ...[...p.selectedBack].filter(l => !p.validBack.has(l)).map(l => l + " (back)")
        ];
        const wrongHtml = wrongPicks.length
          ? `<div><span class="muted">Wrong picks:</span> ${wrongPicks.map(w => `<span class="answer missed">${escapeHtml(w)}</span>`).join(" ")}</div>`
          : "";
        const noneFront = p.validFront.size === 0 ? `<span class="muted">(none)</span>` : frontHtml;
        const noneBack = p.validBack.size === 0 ? `<span class="muted">(none)</span>` : backHtml;
        const statusNote = p.submitted ? "" : `<div class="muted" style="font-size:13px">Skipped — not submitted</div>`;
        return `
          <div class="review-puzzle">
            <h3>${escapeHtml(p.word)}</h3>
            ${statusNote}
            <div><span class="muted">Front:</span> ${noneFront}</div>
            <div style="margin-top:6px"><span class="muted">Back:</span> ${noneBack}</div>
            ${wrongHtml}
          </div>
        `;
      }).join("");

      root.innerHTML = `
        <div class="card">
          <h2>Review</h2>
          <p class="review-summary">You got <strong>${c}</strong> of <strong>${t}</strong> (${pct}%) in <strong>${formatTime(timeSeconds)}</strong>.</p>
          ${blocks}
        </div>
      `;
    }

    function reviewSide(valid, selected) {
      return [...valid].sort().map(l => {
        const cls = selected.has(l) ? "found" : "missed";
        return `<span class="answer ${cls}">${escapeHtml(l)}</span>`;
      }).join(" ");
    }
  });
}
