import { CONFIG } from "./config.js";

export async function fetchRows() {
  if (!CONFIG.leaderboardCsvUrl) return null; // not configured yet
  const res = await fetch(CONFIG.leaderboardCsvUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map(h => normalizeHeader(h));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else cur += ch;
    } else {
      if (ch === ",") { out.push(cur); cur = ""; }
      else if (ch === '"') inQuotes = true;
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function normalizeHeader(h) {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function pct(row) {
  const total = Number(row.total) || 0;
  const correct = Number(row.correct) || 0;
  return total > 0 ? correct / total : 0;
}

function totalTime(row) {
  return (Number(row.time_seconds) || 0) + (Number(row.penalty_seconds) || 0);
}

export function rankWeekly(rows, puzzleKey) {
  return rows
    .filter(r => (r.puzzle_key || "") === puzzleKey)
    .map(r => ({
      name: r.name || "",
      correct: Number(r.correct) || 0,
      total: Number(r.total) || 0,
      timeSeconds: totalTime(r),
      pct: pct(r)
    }))
    .sort((a, b) => b.pct - a.pct || a.timeSeconds - b.timeSeconds);
}

export function rankPermanentBestPerPlayer(rows, puzzleKey) {
  const bestByName = new Map();
  for (const r of rows) {
    if ((r.puzzle_key || "") !== puzzleKey) continue;
    const entry = {
      name: r.name || "",
      correct: Number(r.correct) || 0,
      total: Number(r.total) || 0,
      timeSeconds: totalTime(r),
      pct: pct(r)
    };
    if (!entry.name) continue;
    const prev = bestByName.get(entry.name);
    if (!prev || entry.pct > prev.pct || (entry.pct === prev.pct && entry.timeSeconds < prev.timeSeconds)) {
      bestByName.set(entry.name, entry);
    }
  }
  return [...bestByName.values()].sort((a, b) => b.pct - a.pct || a.timeSeconds - b.timeSeconds);
}

export function hasNameSubmitted(rows, puzzleKey, name) {
  const needle = name.trim().toLowerCase();
  return rows.some(r =>
    (r.puzzle_key || "") === puzzleKey &&
    (r.name || "").trim().toLowerCase() === needle
  );
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

export function renderTable(container, ranked, opts = {}) {
  const { youName = "" } = opts;
  if (!ranked || ranked.length === 0) {
    container.innerHTML = `<p class="muted">No scores yet. Be the first!</p>`;
    return;
  }
  const rows = ranked.map((r, i) => {
    const pctStr = `${Math.round(r.pct * 100)}%`;
    const timeStr = formatTime(r.timeSeconds);
    const scoreStr = `${r.correct}/${r.total}`;
    const isYou = r.name.trim().toLowerCase() === youName.trim().toLowerCase();
    return `<tr class="${isYou ? "you" : ""}">
      <td class="rank">${i + 1}</td>
      <td>${escapeHtml(r.name)}</td>
      <td class="score">${scoreStr}</td>
      <td class="score">${pctStr}</td>
      <td class="time">${timeStr}</td>
    </tr>`;
  }).join("");
  container.innerHTML = `
    <table class="leaderboard-table">
      <thead><tr><th class="rank">#</th><th>Name</th><th class="score">Score</th><th class="score">%</th><th class="time">Time</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}
