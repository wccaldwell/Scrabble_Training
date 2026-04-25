import { getName, setName, clearName, getPersonalBest, recordAttempt } from "./storage.js";
import { submitScore } from "./submit.js";
import { fetchRows, rankPermanentBestPerPlayer, renderTable, formatTime, escapeHtml } from "./leaderboard.js";
import { runAnagramGame } from "./games/anagram.js";
import { runHooksGame } from "./games/hooks.js";
import { runRecallGame } from "./games/recall.js";

const $ = sel => document.querySelector(sel);

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

  const puzzles = await (await fetch("data/puzzles.json", { cache: "no-store" })).json();
  const perm = puzzles.permanent || {};
  renderList(perm);
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
  const entries = Object.entries(perm);
  if (entries.length === 0) {
    body.innerHTML = `<li class="muted">No practice puzzles yet.</li>`;
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
    body.innerHTML = `<li class="muted">No puzzles match the current filter.</li>`;
    return;
  }

  body.innerHTML = filtered.map(([slug, p]) => {
    const best = getPersonalBest(`permanent:${slug}`);
    const bestText = best
      ? `${best.correct}/${best.total} · ${Math.round((best.correct / best.total) * 100)}% · ${formatTime(best.timeSeconds)}`
      : "Not yet attempted";
    return `
      <li>
        <div class="title-row"><strong>${escapeHtml(p.title)}</strong></div>
        <div class="action-row">
          <span class="pill">${p.type}</span>
          <button data-slug="${escapeHtml(slug)}">Play</button>
        </div>
        <div class="meta">${escapeHtml(bestText)}</div>
      </li>
    `;
  }).join("");

  body.querySelectorAll("button[data-slug]").forEach(btn => {
    btn.addEventListener("click", () => startPuzzle(btn.dataset.slug, perm[btn.dataset.slug]));
  });
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
