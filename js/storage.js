const NAME_KEY = "scrabble_club_name";
const SUBMIT_PREFIX = "scrabble_submitted_";
const BEST_PREFIX = "scrabble_best_";

export function getName() {
  return localStorage.getItem(NAME_KEY) || "";
}

export function setName(name) {
  const clean = (name || "").trim();
  if (!clean) return;
  localStorage.setItem(NAME_KEY, clean);
}

export function clearName() {
  localStorage.removeItem(NAME_KEY);
}

export function hasSubmittedWeek(weekKey) {
  return localStorage.getItem(SUBMIT_PREFIX + weekKey) !== null;
}

export function markSubmittedWeek(weekKey, payload) {
  localStorage.setItem(SUBMIT_PREFIX + weekKey, JSON.stringify(payload));
}

export function getPersonalBest(puzzleKey) {
  const raw = localStorage.getItem(BEST_PREFIX + puzzleKey);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function recordAttempt(puzzleKey, attempt) {
  const prev = getPersonalBest(puzzleKey);
  const attempts = (prev?.attempts || 0) + 1;
  const better = !prev || isBetter(attempt, prev);
  const best = better ? attempt : prev;
  const record = { ...best, attempts };
  localStorage.setItem(BEST_PREFIX + puzzleKey, JSON.stringify(record));
  return record;
}

function isBetter(a, b) {
  const aPct = a.total ? a.correct / a.total : 0;
  const bPct = b.total ? b.correct / b.total : 0;
  if (aPct !== bPct) return aPct > bPct;
  return a.timeSeconds < b.timeSeconds;
}
