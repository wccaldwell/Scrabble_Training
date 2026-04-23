import { getName, setName, clearName, hasSubmittedWeek, markSubmittedWeek } from "./storage.js";
import { submitScore } from "./submit.js";
import { fetchRows, rankWeekly, hasNameSubmitted, renderTable } from "./leaderboard.js";
import { runAnagramGame } from "./games/anagram.js";
import { runHooksGame } from "./games/hooks.js";
import { runRecallGame } from "./games/recall.js";

const $ = sel => document.querySelector(sel);

init().catch(err => {
  console.error(err);
  renderFatal(err);
});

async function init() {
  const puzzlesResp = await fetch("data/puzzles.json", { cache: "no-store" });
  const puzzles = await puzzlesResp.json();

  wireChangeName();

  const { key: weekKey, entry: week } = pickCurrentWeek(puzzles.weekly || {});
  if (!week) {
    $("#no-puzzle").classList.remove("hidden");
    return;
  }

  // Name gate
  if (!getName()) {
    showNameGate(() => init().catch(console.error));
    return;
  }

  renderWeekHeader(weekKey, week);

  // Already submitted on this device?
  const puzzleKey = `weekly:${weekKey}`;
  if (hasSubmittedWeek(weekKey)) {
    $("#already-submitted").classList.remove("hidden");
    await showLeaderboard(puzzleKey);
    return;
  }

  // Server-side double-check: name already in the sheet for this week?
  try {
    const rows = await fetchRows();
    if (rows && hasNameSubmitted(rows, puzzleKey, getName())) {
      markSubmittedWeek(weekKey, { recoveredFromSheet: true });
      $("#already-submitted").classList.remove("hidden");
      await showLeaderboard(puzzleKey);
      return;
    }
  } catch (err) {
    console.warn("Leaderboard check failed (continuing):", err);
  }

  // Run the game.
  const result = await runGame(week);
  if (!result) return; // shouldn't happen

  const payload = {
    name: getName(),
    puzzleKey,
    gameType: week.type,
    correct: result.correct,
    total: result.total,
    timeSeconds: result.timeSeconds,
    penaltySeconds: result.penaltySeconds || 0
  };
  markSubmittedWeek(weekKey, payload);
  await submitScore(payload);
  await showLeaderboard(puzzleKey);
}

function runGame(week) {
  const root = $("#game-root");
  switch (week.type) {
    case "anagram":
      return runAnagramGame(root, week);
    case "hooks":
      return runHooksGame(root, week);
    case "recall":
      return runRecallGame(root, week);
    default:
      root.innerHTML = `<div class="card"><p>Game type "${week.type}" isn't supported yet.</p></div>`;
      return Promise.resolve(null);
  }
}

function pickCurrentWeek(weekly) {
  const today = todayISO();
  const keys = Object.keys(weekly).filter(k => k <= today).sort();
  if (keys.length === 0) return { key: null, entry: null };
  const key = keys[keys.length - 1];
  return { key, entry: weekly[key] };
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function renderWeekHeader(weekKey, week) {
  $("#week-date").textContent = formatDate(weekKey);
  $("#week-type").textContent = week.type;
  $("#week-title").textContent = week.title || "";
  $("#greeting").textContent = `Hi, ${getName()}.`;
  $("#week-header").classList.remove("hidden");
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

async function showLeaderboard(puzzleKey) {
  $("#leaderboard-root").classList.remove("hidden");
  const body = $("#leaderboard-body");
  try {
    const rows = await fetchRows();
    if (rows === null) {
      body.innerHTML = `<p class="muted">Leaderboard not configured yet.</p>`;
      return;
    }
    const ranked = rankWeekly(rows, puzzleKey);
    renderTable(body, ranked, { youName: getName() });
  } catch (err) {
    console.error(err);
    body.innerHTML = `<p class="muted">Couldn't load leaderboard.</p>`;
  }
}

function showNameGate(onDone) {
  const gate = $("#name-gate");
  gate.classList.remove("hidden");
  const form = $("#name-form");
  form.addEventListener("submit", e => {
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
    if (!next.trim()) {
      clearName();
      location.reload();
      return;
    }
    setName(next);
    location.reload();
  });
}

function renderFatal(err) {
  document.querySelector("#app").innerHTML = `
    <div class="card">
      <h2>Something went wrong</h2>
      <p class="muted">${String(err?.message || err)}</p>
    </div>
  `;
}
