import { getName } from "./storage.js";
import {
  fetchRows,
  rankPermanentBestPerPlayer,
  renderTable,
  escapeHtml,
  formatTime
} from "./leaderboard.js";

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

  const you = getName();
  const youKey = you ? you.trim().toLowerCase() : "";
  const notice = rows === null
    ? `<p class="muted">Leaderboards aren't configured yet — scores will appear here once submissions start coming in.</p>`
    : `<p class="muted">Best attempt per player. Click any card to see the full leaderboard.</p>`;

  const cards = entries.map(([slug, p]) => buildCard(slug, p, rows, you, youKey)).join("");
  root.innerHTML = `
    <section class="card">
      <h2>Practice leaderboards</h2>
      ${notice}
      <div class="filter-bar">
        <div class="filter-group" id="board-type-filter">
          <button type="button" class="filter-pill active" data-type="all">All</button>
          <button type="button" class="filter-pill" data-type="anagram">Anagram</button>
          <button type="button" class="filter-pill" data-type="hooks">Hooks</button>
          <button type="button" class="filter-pill" data-type="recall">Recall</button>
        </div>
      </div>
      <div class="boards-grid">${cards}</div>
      <p id="boards-empty" class="muted hidden" style="margin-top:12px">No leaderboards match the current filter.</p>
    </section>
  `;

  const allCards = Array.from(root.querySelectorAll(".board-card"));
  const typeFilter = $("#board-type-filter");
  const emptyMsg = $("#boards-empty");

  function applyFilters() {
    const activeType = typeFilter.querySelector(".filter-pill.active")?.dataset.type || "all";
    let visible = 0;
    allCards.forEach(c => {
      const show = activeType === "all" || c.dataset.type === activeType;
      c.classList.toggle("hidden", !show);
      if (show) visible++;
    });
    emptyMsg.classList.toggle("hidden", visible !== 0);
  }

  typeFilter.addEventListener("click", e => {
    const btn = e.target.closest(".filter-pill");
    if (!btn) return;
    typeFilter.querySelectorAll(".filter-pill").forEach(p => p.classList.toggle("active", p === btn));
    applyFilters();
  });

  root.querySelectorAll(".board-card details").forEach(d => {
    d.addEventListener("toggle", () => {
      if (!d.open) return;
      const slug = d.dataset.slug;
      const body = d.querySelector(".board-table");
      if (body.dataset.loaded === "1") return;
      const ranked = rows ? rankPermanentBestPerPlayer(rows, `permanent:${slug}`) : [];
      renderTable(body, ranked, { youName: you });
      body.dataset.loaded = "1";
    });
  });
}

function buildCard(slug, puzzle, rows, you, youKey) {
  const ranked = rows ? rankPermanentBestPerPlayer(rows, `permanent:${slug}`) : [];
  const top = ranked[0];
  const youIdx = youKey
    ? ranked.findIndex(r => r.name.trim().toLowerCase() === youKey)
    : -1;
  const yourEntry = youIdx >= 0 ? ranked[youIdx] : null;

  const topLine = top
    ? `<span class="board-row-label">Top</span> <strong>${escapeHtml(top.name)}</strong> · ${top.correct}/${top.total} · ${formatTime(top.timeSeconds)}`
    : `<span class="muted">No scores yet</span>`;

  let youLine;
  if (!you) {
    youLine = `<span class="muted">Set your name to track your scores</span>`;
  } else if (yourEntry) {
    youLine = `<span class="board-row-label">You</span> #${youIdx + 1} · ${yourEntry.correct}/${yourEntry.total} · ${formatTime(yourEntry.timeSeconds)}`;
  } else {
    youLine = `<span class="board-row-label">You</span> <span class="muted">Not yet attempted</span>`;
  }

  const pill = puzzle.type ? `<span class="pill">${escapeHtml(puzzle.type)}</span>` : "";
  const title = escapeHtml(puzzle.title || slug);
  return `
    <article class="board-card" data-type="${escapeHtml(puzzle.type || "")}">
      <details data-slug="${escapeHtml(slug)}">
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
    </article>
  `;
}
