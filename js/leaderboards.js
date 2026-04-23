import { getName } from "./storage.js";
import { fetchRows, rankWeekly, rankPermanentBestPerPlayer, renderTable, escapeHtml } from "./leaderboard.js";

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

  const root = $("#boards-root");
  const you = getName();
  const sections = [];

  const weekly = puzzles.weekly || {};
  const weekKey = pickCurrentWeek(weekly);
  if (weekKey) {
    const week = weekly[weekKey];
    sections.push({
      heading: `This week · ${formatDate(weekKey)}`,
      subheading: week.title || "",
      type: week.type,
      ranked: rows ? rankWeekly(rows, `weekly:${weekKey}`) : null
    });
  }

  const perm = puzzles.permanent || {};
  for (const [slug, p] of Object.entries(perm)) {
    sections.push({
      heading: p.title || slug,
      subheading: p.description || "",
      type: p.type,
      ranked: rows ? rankPermanentBestPerPlayer(rows, `permanent:${slug}`) : null
    });
  }

  if (sections.length === 0) {
    root.innerHTML = `<div class="card"><p class="muted">No puzzles yet.</p></div>`;
    return;
  }

  root.innerHTML = sections.map((s, i) => sectionShell(s, i)).join("");

  sections.forEach((s, i) => {
    const body = root.querySelector(`[data-board-body="${i}"]`);
    if (!body) return;
    if (rows === null) {
      body.innerHTML = `<p class="muted">Leaderboard not configured yet.</p>`;
    } else {
      renderTable(body, s.ranked, { youName: you });
    }
  });
}

function sectionShell({ heading, subheading, type }, i) {
  const sub = subheading ? `<p class="muted" style="margin-top:0">${escapeHtml(subheading)}</p>` : "";
  const pill = type ? `<span class="pill">${escapeHtml(type)}</span>` : "";
  return `
    <section class="card">
      <div class="week-meta">${pill}</div>
      <h2 style="margin-top:4px">${escapeHtml(heading)}</h2>
      ${sub}
      <div data-board-body="${i}" class="muted">Loading…</div>
    </section>
  `;
}

function pickCurrentWeek(weekly) {
  const today = todayISO();
  const keys = Object.keys(weekly).filter(k => k <= today).sort();
  return keys.length ? keys[keys.length - 1] : null;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
