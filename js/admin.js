import { runAnagramGame } from "./games/anagram.js";
import { runHooksGame } from "./games/hooks.js";
import { runRecallGame } from "./games/recall.js";
import { escapeHtml } from "./leaderboard.js";

const $ = sel => document.querySelector(sel);

init().catch(err => console.error(err));

async function init() {
  const puzzles = await (await fetch("data/puzzles.json", { cache: "no-store" })).json();
  renderWeekly(puzzles.weekly || {});
  renderPermanent(puzzles.permanent || {});
  wireResetButtons();
}

function wireResetButtons() {
  const status = $("#reset-status");
  const show = msg => { status.textContent = msg; };
  const clearByPrefix = prefix => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
    keys.forEach(k => localStorage.removeItem(k));
    return keys.length;
  };

  $("#reset-weekly").addEventListener("click", () => {
    const n = clearByPrefix("scrabble_submitted_");
    show(`Cleared ${n} weekly submission lock${n === 1 ? "" : "s"}. Refresh the home page.`);
  });
  $("#reset-bests").addEventListener("click", () => {
    const n = clearByPrefix("scrabble_best_");
    show(`Cleared ${n} practice best${n === 1 ? "" : "s"}.`);
  });
  $("#reset-name").addEventListener("click", () => {
    localStorage.removeItem("scrabble_club_name");
    show("Cleared saved name.");
  });
  $("#reset-all").addEventListener("click", () => {
    if (!confirm("Clear all local state (name, submission locks, practice bests)?")) return;
    const before = localStorage.length;
    localStorage.clear();
    show(`Cleared ${before} key${before === 1 ? "" : "s"} from localStorage.`);
  });
}

function renderWeekly(weekly) {
  const today = todayISO();
  const keys = Object.keys(weekly).sort();
  const currentKey = [...keys].reverse().find(k => k <= today);
  const body = $("#weekly-list");
  if (keys.length === 0) { body.innerHTML = `<li class="muted">None queued.</li>`; return; }
  body.innerHTML = keys.map(k => {
    const p = weekly[k];
    const isCurrent = k === currentKey;
    const when = k > today ? "upcoming" : (k === currentKey ? "current" : "past");
    return `
      <li class="${isCurrent ? "current" : ""}">
        <div>
          <strong>${k}</strong> <span class="pill">${p.type}</span>
          <div class="meta muted">${escapeHtml(p.title || "")} · ${when} · ${puzzleCount(p)} items</div>
        </div>
        <button class="secondary" data-kind="weekly" data-key="${k}">Preview</button>
      </li>
    `;
  }).join("");
  body.querySelectorAll("button[data-key]").forEach(btn => {
    btn.addEventListener("click", () => preview(weekly[btn.dataset.key]));
  });
}

function renderPermanent(perm) {
  const body = $("#permanent-list");
  const keys = Object.keys(perm);
  if (keys.length === 0) { body.innerHTML = `<li class="muted">None yet.</li>`; return; }
  body.innerHTML = keys.map(k => {
    const p = perm[k];
    return `
      <li>
        <div>
          <strong>${escapeHtml(k)}</strong> <span class="pill">${p.type}</span>
          <div class="meta muted">${escapeHtml(p.title || "")} · ${puzzleCount(p)} items</div>
        </div>
        <button class="secondary" data-kind="perm" data-key="${escapeHtml(k)}">Preview</button>
      </li>
    `;
  }).join("");
  body.querySelectorAll("button[data-key]").forEach(btn => {
    btn.addEventListener("click", () => preview(perm[btn.dataset.key]));
  });
}

function puzzleCount(p) {
  if (Array.isArray(p.puzzles)) return `${p.puzzles.length} puzzle${p.puzzles.length === 1 ? "" : "s"}`;
  if (Array.isArray(p.answers)) return `${p.answers.length} answers`;
  return "";
}

async function preview(puzzle) {
  const root = $("#preview-root");
  root.scrollIntoView({ behavior: "smooth" });
  root.innerHTML = `<div class="card"><h2>Preview: ${escapeHtml(puzzle.title || "")}</h2><p class="muted">Scores are not submitted in preview mode.</p></div>`;
  const gameHost = document.createElement("section");
  root.appendChild(gameHost);
  if (puzzle.type === "anagram") {
    await runAnagramGame(gameHost, puzzle);
  } else if (puzzle.type === "hooks") {
    await runHooksGame(gameHost, puzzle);
  } else if (puzzle.type === "recall") {
    await runRecallGame(gameHost, puzzle);
  } else {
    gameHost.innerHTML = `<div class="card"><p>Game type "${puzzle.type}" isn't supported in preview yet.</p></div>`;
  }
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
