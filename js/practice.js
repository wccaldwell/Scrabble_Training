import { getName, setName, clearName, getPersonalBest, recordAttempt } from "./storage.js";
import { submitScore } from "./submit.js";
import { fetchRows, rankPermanentBestPerPlayer, renderTable, formatTime, escapeHtml } from "./leaderboard.js";
import { runAnagramGame } from "./games/anagram.js";
import { runHooksGame } from "./games/hooks.js";
import { runRecallGame } from "./games/recall.js";

const $ = sel => document.querySelector(sel);

let cachedRows = null;

init().catch(err => {
  console.error(err);
  document.querySelector("#app").innerHTML = `<div class="card"><h2>Something went wrong</h2><p class="muted">${escapeHtml(String(err))}</p></div>`;
});

async function init() {
  wireChangeName();

  if (!getName()) {
    showNameGate(() => init().catch(console.error));
    return;
  }

  const [puzzles, rows] = await Promise.all([
    fetch("data/puzzles.json", { cache: "no-store" }).then(r => r.json()),
    fetchRows().catch(err => { console.error(err); return null; })
  ]);
  cachedRows = rows;
  renderList(puzzles.permanent || {});
}

function renderList(perm) {
  const section = $("#practice-list");
  section.classList.remove("hidden");
  wireFilters(perm);
  drawList(perm);
}

function wireFilters(perm) {
  $("#type-filter").addEventListener("click", e => {
    const btn = e.target.closest(".filter-pill");
    if (!btn) return;
    $("#type-filter").querySelectorAll(".filter-pill").forEach(b => b.classList.toggle("active", b === btn));
    drawList(perm);
  });
  $("#unattempted-only").addEventListener("change", () => drawList(perm));
}

function drawList(perm) {
  const body = $("#practice-list-body");
  const empty = $("#practice-list-empty");
  const entries = Object.entries(perm);
  if (entries.length === 0) {
    body.innerHTML = "";
    empty.textContent = "No practice puzzles yet.";
    empty.classList.remove("hidden");
    return;
  }

  const activeType = $("#type-filter").querySelector(".filter-pill.active")?.dataset.type || "all";
  const unattemptedOnly = $("#unattempted-only").checked;

  const filtered = entries.filter(([slug, p]) => {
    if (activeType !== "all" && p.type !== activeType) return false;
    if (unattemptedOnly && getPersonalBest(`permanent:${slug}`)) return false;
    return true;
  });

  if (filtered.length === 0) {
    body.innerHTML = "";
    empty.textContent = "No puzzles match the current filter.";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const you = getName();
  const youKey = you ? you.trim().toLowerCase() : "";

  body.innerHTML = filtered.map(([slug, p]) => buildCard(slug, p, cachedRows, you, youKey)).join("");

  body.querySelectorAll(".board-card").forEach(card => {
    const slug = card.dataset.slug;
    const details = card.querySelector("details");
    const toggleBtn = card.querySelector(".expand-toggle");
    const playBtn = card.querySelector(".play-btn");

    if (details && toggleBtn) {
      toggleBtn.addEventListener("click", e => {
        e.preventDefault();
        details.open = !details.open;
      });
      details.addEventListener("toggle", () => {
        if (!details.open) return;
        const tableEl = details.querySelector(".board-table");
        if (tableEl.dataset.loaded === "1") return;
        const ranked = cachedRows ? rankPermanentBestPerPlayer(cachedRows, `permanent:${slug}`) : [];
        renderTable(tableEl, ranked, { youName: you });
        tableEl.dataset.loaded = "1";
      });
    }

    if (playBtn) {
      playBtn.addEventListener("click", e => {
        e.stopPropagation();
        startPuzzle(slug, perm[slug]);
      });
    }
  });
}

function buildCard(slug, puzzle, rows, you, youKey) {
  const ranked = rows ? rankPermanentBestPerPlayer(rows, `permanent:${slug}`) : [];
  const top = ranked[0];
  const youIdx = youKey
    ? ranked.findIndex(r => r.name.trim().toLowerCase() === youKey)
    : -1;
  const yourEntry = youIdx >= 0 ? ranked[youIdx] : null;
  const personalBest = getPersonalBest(`permanent:${slug}`);
  const hasPlayed = !!(yourEntry || personalBest);

  const topLine = top
    ? `<span class="board-row-label">Top</span> <strong>${escapeHtml(top.name)}</strong> · ${top.correct}/${top.total} · ${formatTime(top.timeSeconds)}`
    : `<span class="muted">No scores yet — be the first!</span>`;

  let youLine;
  if (!you) {
    youLine = `<span class="muted">Set your name to track your scores</span>`;
  } else if (yourEntry) {
    youLine = `<span class="board-row-label">You</span> #${youIdx + 1} · ${yourEntry.correct}/${yourEntry.total} · ${formatTime(yourEntry.timeSeconds)} <span class="pb-badge">your best</span>`;
  } else if (personalBest) {
    youLine = `<span class="board-row-label">You</span> ${personalBest.correct}/${personalBest.total} · ${formatTime(personalBest.timeSeconds)} <span class="pb-badge">your best</span>`;
  } else {
    youLine = `<span class="board-row-label">You</span> <span class="muted">Not yet attempted</span> <span class="untried-badge">new to you</span>`;
  }

  const pill = puzzle.type ? `<span class="pill">${escapeHtml(puzzle.type)}</span>` : "";
  const title = escapeHtml(puzzle.title || slug);
  const playLabel = hasPlayed ? "Play again" : "Play";
  return `
    <article class="board-card" data-type="${escapeHtml(puzzle.type || "")}" data-slug="${escapeHtml(slug)}">
      <details>
        <summary>
          <div class="board-card-head">
            <div class="board-card-title">${title}</div>
            ${pill}
          </div>
          <div class="board-card-row">${topLine}</div>
          <div class="board-card-row">${youLine}</div>
        </summary>
        <div class="board-table muted">Loading…</div>
      </details>
      <div class="board-card-foot">
        <button class="play-btn" type="button">${playLabel}</button>
        <button class="expand-toggle" type="button"><span class="toggle-label"></span><span class="chev">▾</span></button>
      </div>
    </article>
  `;
}

async function startPuzzle(slug, puzzle) {
  $("#practice-list").classList.add("hidden");
  const root = $("#game-root");
  const puzzleKey = `permanent:${slug}`;

  let result = null;
  if (puzzle.type === "anagram") {
    result = await runAnagramGame(root, puzzle);
  } else if (puzzle.type === "hooks") {
    result = await runHooksGame(root, puzzle);
  } else if (puzzle.type === "recall") {
    result = await runRecallGame(root, puzzle);
  } else {
    root.innerHTML = `<div class="card"><p>Game type "${puzzle.type}" isn't supported yet. Coming soon.</p><button id="back">Back</button></div>`;
    root.querySelector("#back").addEventListener("click", () => location.reload());
    return;
  }

  if (!result) return;

  const attempt = {
    correct: result.correct,
    total: result.total,
    timeSeconds: result.timeSeconds + (result.penaltySeconds || 0)
  };
  recordAttempt(puzzleKey, attempt);

  await submitScore({
    name: getName(),
    puzzleKey,
    gameType: puzzle.type,
    correct: result.correct,
    total: result.total,
    timeSeconds: result.timeSeconds,
    penaltySeconds: result.penaltySeconds || 0
  });

  await showLeaderboard(puzzleKey, puzzle.title);
  addReplayLink(slug, puzzle);
}

async function showLeaderboard(puzzleKey, title) {
  const section = $("#leaderboard-root");
  section.classList.remove("hidden");
  $("#leaderboard-title").textContent = `Leaderboard — ${title}`;
  const body = $("#leaderboard-body");
  try {
    const rows = await fetchRows();
    if (rows === null) {
      body.innerHTML = `<p class="muted">Leaderboard not configured yet.</p>`;
      return;
    }
    const ranked = rankPermanentBestPerPlayer(rows, puzzleKey);
    renderTable(body, ranked, { youName: getName() });
  } catch (err) {
    console.error(err);
    body.innerHTML = `<p class="muted">Couldn't load leaderboard.</p>`;
  }
}

function addReplayLink(slug, puzzle) {
  const section = $("#leaderboard-root");
  const actions = document.createElement("div");
  actions.className = "game-actions";
  actions.style.marginTop = "16px";
  actions.innerHTML = `
    <button class="secondary" id="back-list">Back to practice list</button>
    <button id="play-again">Play again</button>
  `;
  section.appendChild(actions);
  actions.querySelector("#back-list").addEventListener("click", () => location.reload());
  actions.querySelector("#play-again").addEventListener("click", () => location.reload());
}

function showNameGate(onDone) {
  const gate = $("#name-gate");
  gate.classList.remove("hidden");
  $("#name-form").addEventListener("submit", e => {
    e.preventDefault();
    const val = $("#name-input").value.trim();
    if (!val) return;
    setName(val);
    gate.classList.add("hidden");
    onDone();
  });
}

function wireChangeName() {
  const btn = $("#change-name");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = prompt("Your name:", getName() || "");
    if (next === null) return;
    if (!next.trim()) { clearName(); location.reload(); return; }
    setName(next);
    location.reload();
  });
}
