import { getName } from "./storage.js";
import { fetchRows, rankWeekly, renderTable, escapeHtml } from "./leaderboard.js";
import { renderAnagramAnswers } from "./games/anagram.js";
import { renderHooksAnswers } from "./games/hooks.js";
import { renderRecallAnswers } from "./games/recall.js";

const $ = sel => document.querySelector(sel);

init().catch(err => {
  console.error(err);
  $("#archive-root").innerHTML = `<div class="card"><h2>Couldn't load the archive</h2><p class="muted">${escapeHtml(String(err?.message || err))}</p></div>`;
});

async function init() {
  const [puzzles, rows] = await Promise.all([
    fetch("data/puzzles.json", { cache: "no-store" }).then(r => r.json()),
    fetchRows()
  ]);

  const weekly = puzzles.weekly || {};
  const today = todayISO();
  const pastKeys = Object.keys(weekly)
    .filter(k => k < today)
    .sort()
    .reverse();

  const root = $("#archive-root");
  if (pastKeys.length === 0) {
    root.innerHTML = `<div class="card"><h2>Archive</h2><p class="muted">Nothing in the archive yet — past weekly puzzles will show up here.</p></div>`;
    return;
  }

  const options = pastKeys.map(k => {
    const p = weekly[k];
    const label = `${formatDate(k)} — ${p.title || p.type}`;
    return `<option value="${escapeHtml(k)}">${escapeHtml(label)}</option>`;
  }).join("");

  root.innerHTML = `
    <section class="card">
      <h2 style="margin-top:0">Archive</h2>
      <label for="week-select" class="muted" style="font-size:13px;text-transform:uppercase;letter-spacing:0.05em">Week</label>
      <select id="week-select" class="puzzle-select">${options}</select>
      <div id="week-header" style="margin-top:14px"></div>
      <div id="week-answers" style="margin-top:10px"></div>
    </section>
    <section id="week-board" class="card">
      <h2 id="board-title" style="margin-top:0">Leaderboard</h2>
      <div id="board-body" class="muted">Loading…</div>
    </section>
  `;

  $("#week-select").addEventListener("change", () => renderSelected(weekly, rows));
  renderSelected(weekly, rows);
}

function renderSelected(weekly, rows) {
  const key = $("#week-select").value;
  const week = weekly[key];
  const header = $("#week-header");
  const answers = $("#week-answers");
  const boardTitle = $("#board-title");
  const boardBody = $("#board-body");

  const pill = `<span class="pill">${escapeHtml(week.type)}</span>`;
  header.innerHTML = `
    <div class="week-meta">${pill}</div>
    <h3 style="margin:4px 0 0;font-family:var(--font-serif)">${escapeHtml(week.title || "")}</h3>
  `;

  let html = "";
  switch (week.type) {
    case "anagram": html = renderAnagramAnswers(week); break;
    case "hooks":   html = renderHooksAnswers(week); break;
    case "recall":  html = renderRecallAnswers(week); break;
    default:        html = `<p class="muted">Answers aren't available for this puzzle type.</p>`;
  }
  answers.innerHTML = html;

  boardTitle.textContent = `Leaderboard — ${formatDate(key)}`;
  if (rows === null) {
    boardBody.innerHTML = `<p class="muted">Leaderboard not configured yet.</p>`;
    return;
  }
  const ranked = rankWeekly(rows, `weekly:${key}`);
  renderTable(boardBody, ranked, { youName: getName() });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
