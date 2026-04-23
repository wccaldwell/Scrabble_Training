import { getName } from "./storage.js";
import { fetchRows, rankPermanentBestPerPlayer, renderTable, escapeHtml } from "./leaderboard.js";

const $ = sel => document.querySelector(sel);

init().catch(err => {
  console.error(err);
  $("#boards-root").innerHTML = `<div class="card"><h2>Couldn't load leaderboards</h2><p class="muted">${escapeHtml(String(err?.message || err))}</p></div>`;
});

async function init() {
  const [puzzles, rows] = await Promise.all([
    fetch("data/puzzles.json", { cache: "no-store" }).then(r => r.json()),
    fetchRows()
  ]);

  const perm = puzzles.permanent || {};
  const entries = Object.entries(perm);
  const root = $("#boards-root");

  if (entries.length === 0) {
    root.innerHTML = `<div class="card"><p class="muted">No practice puzzles yet.</p></div>`;
    return;
  }

  const options = entries
    .map(([slug, p]) => `<option value="${escapeHtml(slug)}">${escapeHtml(p.title || slug)}</option>`)
    .join("");

  root.innerHTML = `
    <section class="card">
      <label for="puzzle-select" class="muted" style="font-size:13px;text-transform:uppercase;letter-spacing:0.05em">Puzzle</label>
      <select id="puzzle-select" class="puzzle-select">
        ${options}
      </select>
      <div id="board-header" style="margin-top:14px"></div>
      <div id="board-body" class="muted" style="margin-top:10px">Loading…</div>
    </section>
  `;

  const select = $("#puzzle-select");
  select.addEventListener("change", () => renderSelected(perm, rows));
  renderSelected(perm, rows);
}

function renderSelected(perm, rows) {
  const slug = $("#puzzle-select").value;
  const puzzle = perm[slug];
  const header = $("#board-header");
  const body = $("#board-body");
  const you = getName();

  const pill = puzzle.type ? `<span class="pill">${escapeHtml(puzzle.type)}</span>` : "";
  const desc = puzzle.description
    ? `<p class="muted" style="margin:6px 0 0">${escapeHtml(puzzle.description)}</p>`
    : "";
  header.innerHTML = `
    <div class="week-meta">${pill}</div>
    <h2 style="margin:4px 0 0">${escapeHtml(puzzle.title || slug)}</h2>
    ${desc}
  `;

  if (rows === null) {
    body.innerHTML = `<p class="muted">Leaderboard not configured yet.</p>`;
    return;
  }
  const ranked = rankPermanentBestPerPlayer(rows, `permanent:${slug}`);
  renderTable(body, ranked, { youName: you });
}
