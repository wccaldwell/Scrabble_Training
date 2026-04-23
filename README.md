# Scrabble Training

A tiny static site for a Scrabble club to run weekly puzzle competitions plus an always-available practice library. Hosted on GitHub Pages. Submissions go to a Google Form → Sheet; the Sheet is the leaderboard data source.

## What's here so far

- `index.html` — this week's puzzle + leaderboard
- `practice.html` — permanent puzzles with per-puzzle leaderboards
- `admin.html` — preview queued puzzles without submitting
- `data/puzzles.json` — all weekly + permanent puzzles
- `js/` — game logic, storage, submission, leaderboard
- `css/styles.css`

Implemented games: **anagram**, **hooks**, **recall** — all three playable in weekly and practice modes.

## Local testing

Modern browsers block `fetch()` of local files when you open `index.html` directly. Run a dev server:

```bash
# any of these works
python -m http.server 8000
# or
npx serve .
```

Then visit `http://localhost:8000/`.

## Deploying (GitHub Pages)

1. Push to `main`.
2. Repo → Settings → Pages → Source: **Deploy from a branch**, branch: `main`, folder: `/ (root)`.
3. Wait a minute; site is at `https://wccaldwell.github.io/Scrabble_Training/`.

## Google Form + Sheet setup (required for submissions + leaderboard)

The site works without this, but every submission just logs to the console. Do this once:

### 1. Create the Form
1. https://forms.google.com → Blank form.
2. Add these **Short answer** questions (names here match the code; the order doesn't matter):
   - `name`
   - `puzzle_key`
   - `game_type`
   - `correct`
   - `total`
   - `time_seconds`
   - `penalty_seconds`
3. Top right → three dots → **Get pre-filled link**. Fill every field with any value → **Get link** → copy it somewhere.

### 2. Find the Form action URL + field IDs
From the pre-filled link you copied:
- The URL looks like `https://docs.google.com/forms/d/e/XYZ/viewform?entry.1234=foo&entry.5678=bar&…`
- Replace `viewform` with `formResponse` → that's your **form action URL**.
- Each `entry.NNNN=…` parameter tells you which numeric ID maps to which field (match by the value you typed).

### 3. Fill in `js/config.js`
```js
export const CONFIG = {
  googleFormActionUrl: "https://docs.google.com/forms/d/e/XYZ/formResponse",
  formFields: {
    name:            "entry.1111",
    puzzleKey:       "entry.2222",
    gameType:        "entry.3333",
    correct:         "entry.4444",
    total:           "entry.5555",
    timeSeconds:     "entry.6666",
    penaltySeconds:  "entry.7777"
  },
  leaderboardCsvUrl: ""  // fill in next step
};
```

### 4. Link a Sheet + publish it
1. In the Form editor → **Responses** tab → green Sheets icon → create a new Sheet.
2. Rename the response columns in row 1 to the **lowercase snake_case** headers the code expects (same names as above: `name`, `puzzle_key`, etc. — the parser is lenient about case/spaces but keep it clean). The Form will keep writing to the same columns by position; renaming the headers is safe.
3. File → **Share** → **Publish to web** → Link → **Comma-separated values (.csv)** → Publish. Copy that URL into `leaderboardCsvUrl` in `js/config.js`.

### 5. Commit + push
```bash
git add js/config.js
git commit -m "Wire up Google Form + leaderboard"
git push
```

## Queueing weekly puzzles

Edit `data/puzzles.json`. Each weekly entry is keyed by an ISO date (Monday of the competition week works well). The site automatically shows the most recent entry whose date is ≤ today.

```json
"weekly": {
  "2026-04-27": {
    "type": "anagram",
    "title": "7-letter bingos",
    "puzzles": [
      { "scramble": "ETAINSR", "answers": ["RETAINS", "RETSINA", "STAINER"] }
    ]
  }
}
```

Queue as many future weeks as you want in one commit. They become the active puzzle automatically when their date arrives.

## Adding practice puzzles

Under `permanent`, keyed by a URL-friendly slug. These never expire; players can replay; leaderboards use each player's best attempt.

```json
"permanent": {
  "two-letter-words": {
    "type": "recall",
    "title": "All 2-letter Scrabble words",
    "answers": ["AA", "AB", "..."],
    "missPenaltySeconds": 5
  }
}
```

## Game-type cheat sheet

- **anagram** — one scramble at a time; one wrong guess locks the word (partial credit kept for any correct answers already found); skip + return; finishes when all puzzles are solved-or-locked or the player gives up.
- **recall** — one screen, single input, list of found words accumulates; unlimited wrong guesses, each adds `missPenaltySeconds` to the displayed and submitted time.
- **hooks** — 5×6 grid of front hooks to the left of the word, same on the right for back hooks; tap to toggle; one submit per word reveals green/red/missed; partial credit like anagrams.

## Admin page

`/admin.html` lists every queued week and permanent puzzle with a Preview button. Not linked from the site — bookmark the URL.

## One-submission guard (weekly)

1. On submit, we write a flag to `localStorage` for that week so re-opening the page shows the leaderboard instead of the game.
2. On page load, we also check the published sheet for the player's name in the current week. If found, same result. This survives a different browser/device as long as they use the same name.

Honor-system — not enforcement. Fine for a 15-person club.
