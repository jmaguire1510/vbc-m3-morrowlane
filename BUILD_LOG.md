# Build Log — Morrowlane Service Request Portal (Module 3)

This log records each assignment step as it was actually performed: what existed,
what was changed, what was tested, and what was observed. All results below come
from real commands run in the development environment.

**Commit hash convention:** a commit cannot contain its own hash, so each step's
hash is filled in by the following step's commit (or read from `git log`).

---

## STEP 1 — Diagnose the starter project

**Date:** 2026-11-20

### Starting state
- Repository contains only the starter: `app/page.js` (finished front end, client
  component), `app/layout.js`, `app/globals.css`, `data/seed-requests.csv`,
  `README.md`, `SUBMISSION.md`, `.env.example`, `.gitignore`, `package.json`.
- One commit: `a26a2ae Initial commit`.
- **No API routes exist.** There is no `app/api/` folder and no `route.js` file anywhere.
- Stack: Next.js 15.5.25 (App Router), React 19.2.8, Node 22.23.5.

### Objective
Run the starter locally, reproduce the failed Save, record the exact error, and
explain the cause. **Do not fix anything.**

### What I did
1. `npm install` (no changes to `package-lock.json`).
2. `npm run dev` → server ready at `http://localhost:3000`.
3. Opened the page in a headless Chromium browser (Playwright), recording browser
   console messages and every `/api/` network response.
4. Filled the form with fictional data — Requester: `Test Coordinator (fictional)`,
   Location: `Denver`, Description: `STEP 1 test - flickering light in break room`,
   Priority: `Medium` — and clicked **Submit request**.
5. Confirmed with `curl` against each endpoint the page uses, and checked the
   dev-server log.

### Expected result
The request saves, a "Request submitted." message appears, the new row shows in the
table, and the tiles update.

### Actual result
- Inline red message under the form: **"Could not reach the server. Please try again."**
- Tiles show `–` / `–` / `–`; table shows "No requests to show yet."
- Screenshot: `docs/evidence/step1-failed-save.png`

### Evidence before change

Browser console / network (captured by Playwright):

```
[network] GET  http://localhost:3000/api/summary  -> 404 text/html; charset=utf-8
[console.error] Failed to load resource: the server responded with a status of 404 (Not Found) http://localhost:3000/api/summary
[network] GET  http://localhost:3000/api/requests -> 404 text/html; charset=utf-8
[console.error] Failed to load resource: the server responded with a status of 404 (Not Found) http://localhost:3000/api/requests
TILES: – | – | –
TABLE: No requests to show yet.
--- clicking Submit ---
[network] POST http://localhost:3000/api/requests -> 404 text/html; charset=utf-8
[console.error] Failed to load resource: the server responded with a status of 404 (Not Found) http://localhost:3000/api/requests
FORM MESSAGE: Could not reach the server. Please try again. | class: form-message form-message-error
```

`curl` against every endpoint in the README contract:

```
GET    /api/requests        -> 404 text/html; charset=utf-8
GET    /api/summary         -> 404 text/html; charset=utf-8
GET    /api/export          -> 404 text/html; charset=utf-8
PATCH  /api/requests/1      -> 404 text/html; charset=utf-8
POST   /api/requests        -> 404 (body: Next.js HTML page "404: This page could not be found.")
```

Dev-server log excerpt:

```
 GET /api/summary 404 in 463ms
 GET /api/requests 404 in 461ms
 POST /api/requests 404 in 32ms
 GET /api/export 404 in 22ms
 PATCH /api/requests/1 404 in 27ms
```

| Item | Value |
|---|---|
| Failing action | Submit request (Save) |
| Route | `POST /api/requests` |
| HTTP status | `404 Not Found` |
| Response type | `text/html` (Next.js 404 page), not JSON |
| Console error | `Failed to load resource: the server responded with a status of 404 (Not Found) http://localhost:3000/api/requests` |
| On-screen message | "Could not reach the server. Please try again." |

### Root cause (diagnosis)
The front end is complete and is calling the five endpoints in the README contract,
but **none of those endpoints exist**. In the Next.js App Router, an API endpoint is a
`route.js` file under `app/api/...`; this project has no `app/api` folder at all.
Next.js therefore answers every `/api/...` call with its standard HTML 404 page.

Why the message says "Could not reach the server" instead of showing a server error:
`handleSubmit` in `app/page.js` calls `response.json()` before checking
`response.ok`. The 404 body is HTML, so `response.json()` throws, and the `catch`
block shows the generic "Could not reach the server" text. The server *was*
reached — it just had nothing at that address. The same missing routes explain the
`–` tiles and the empty table (GET `/api/summary` and GET `/api/requests` also 404).

What is missing (to be built in later steps):
- `app/api/requests/route.js` — `GET` (list) and `POST` (create)
- `app/api/requests/[id]/route.js` — `PATCH` (status update)
- `app/api/summary/route.js` — `GET` (tile numbers)
- `app/api/export/route.js` — `GET` (CSV download)
- A storage layer that reads `data/seed-requests.csv` (22 data rows + header)

### Files changed
| File | Why |
|---|---|
| `BUILD_LOG.md` | New — this log, Step 1 entry |
| `docs/evidence/step1-failed-save.png` | Screenshot of the failed Save |

No application code was changed.

### Problems encountered
- First Playwright run timed out waiting for `networkidle`: the Next.js dev server
  keeps a hot-reload connection open, so the network never goes idle.

### Resolution
- Changed the script to wait for the page `load` event plus the `/api/requests`
  response. Second run captured the full evidence above.

### Observations recorded for later (not fixed now)
- The seed CSV has 22 data rows and no `id` column; ids must be assigned by storage.
- Front-end quirk: any non-JSON error response produces the misleading "Could not
  reach the server" message. Once real routes return JSON errors (per the README),
  the real message will show. The front end is not to be redesigned, so this is only noted.
- Future deployment risk: if Step 3 saves by writing to a local file, that will not
  persist on Netlify (serverless functions have no durable writable disk). This is
  the intended Step 7 failure and will not be worked around early.

### Verification
Failure reproduced three independent ways (browser UI, curl, server log), all
showing `404` on `/api/requests`. Nothing was fixed.

### Git commit
`4144b21` — Step 1: Diagnose starter project - document failed Save (404)

Push note: `git push` was refused with HTTP 403 ("Claude doesn't have GitHub
access to jmaguire1510/vbc-m3-morrowlane"). The commit stayed local until GitHub
access was fixed.

---

## STEP 2 — Build read endpoints

**Date:** 2026-11-20

### Starting state
- Step 1 committed (`4144b21`). No `app/api` routes; nothing reads the CSV.
- Every API call returns the Next.js HTML 404 page; tiles show `–`, table is empty.

### Objective
Implement only `GET /api/requests` and `GET /api/summary`, reading from
`data/seed-requests.csv`, and verify them against the source data.

### Evidence before change — source data inspection
- `data/seed-requests.csv`: UTF-8, LF line endings, header +
  **22 data rows** (`tail -n +2 | grep -c .` → `22`).
- Columns: `created_at,requester_name,location,description,priority,status`; no `id`.
- 4 rows have quoted descriptions containing commas (e.g.
  `"Water leak under the breakroom sink, floor 6"`), so a naive `split(",")` would
  break them; a proper CSV parser is required.
- Status breakdown: 13 Complete, 6 In Progress, 3 New.

**Hand calculation from the CSV (done before coding):**

| Tile | Rule | Rows | Expected |
|---|---|---|---|
| open_requests | status ≠ Complete | 6 In Progress + 3 New | **9** |
| urgent_open | status ≠ Complete and priority = Urgent | Priya Raghunathan (server room, In Progress), Alison Vo (suite 220 AC, New) | **2** |
| completed_this_month | Complete, in the month of the latest request | Latest = 2026-08-28 → Aug 2026. Complete in Aug: Renata Oyelaran 08-03, Grant Pemberton 08-04, Sofia Marchetti 08-06, Isaac Fontaine 08-07, Dana Whitfield 08-10 | **5** |

### Files changed
| File | Why |
|---|---|
| `lib/csv.js` | New — CSV parser that handles quoted fields and `""` escapes |
| `lib/requests-store.js` | New — reads the seed CSV, assigns ids 1..22 in file order, sorts newest first |
| `lib/summary.js` | New — the three tile calculations |
| `app/api/requests/route.js` | New — `GET /api/requests` |
| `app/api/summary/route.js` | New — `GET /api/summary` |
| `docs/evidence/step2-read-endpoints.png` | Screenshot of the filled table and tiles |
| `BUILD_LOG.md` | Step 1 hash + Step 2 entry |

### Changes made
- Storage reads `data/seed-requests.csv` on each request. Ids are assigned by row
  order (oldest = 1, newest = 22) because the CSV has no id column.
- Newest-first sort on `created_at`, with id as a tie-breaker.
- "This month" uses the **UTC** month of the most recent `created_at` (timestamps
  are stored with `Z`), not today's date.
- Both handlers are wrapped in try/catch and return `500 {"error": "..."}` on failure.

### Tests performed and results

| Test | Result |
|---|---|
| `curl /api/requests` | `HTTP 200 application/json` |
| `curl /api/summary` | `HTTP 200 application/json` → `{"open_requests":9,"urgent_open":2,"completed_this_month":5}` |
| Row count | 22 (matches CSV) |
| Newest-first order | True — first `2026-08-28T17:45:00Z` Alison Vo (id 22), last `2026-07-16T14:20:00Z` Dana Whitfield (id 1) |
| Every field matches CSV | True (all 22 records compared field-by-field with Python's `csv` module) |
| Quoted comma row parsed | `Water leak under the breakroom sink, floor 6` ✔ |
| Unique ids | True |
| Browser: tiles | `9 | 2 | 5` — matches hand calculation |
| Browser: table | 22 rows; row 1 `Aug 28, 2026 | Alison Vo | …`, row 22 `Jul 16, 2026 | Dana Whitfield | …` |
| Browser console | No errors; both calls `200` |
| 500 path (seed file temporarily renamed, then restored) | `500 {"error":"Could not load requests. Please try again."}` and `500 {"error":"Could not load the summary. Please try again."}`; `200` again after restoring |
| `npm run build` | Success; `/api/requests` and `/api/summary` listed as `ƒ (Dynamic)` |

### Problems encountered
1. First draft exported `calculateSummary` from `app/api/summary/route.js`. Next.js
   only allows HTTP-method exports (and a few config names) from route files, so
   this would fail at build time.
2. First draft imported with `@/lib/...`, which needs a `jsconfig.json` path alias
   the project doesn't have.

### Resolution
1. Moved the calculation to `lib/summary.js`.
2. Switched to relative imports. Both caught before running; build passes.

### Observations recorded for later (not fixed now)
- Ids are derived from row order. That is fine while the data is read-only; Step 3
  needs a storage approach where new rows get the next id and existing ids stay stable.
- On Netlify, reading `data/` relies on Next.js file tracing bundling the CSV with
  the function — check in Step 7.

### Verification
API output, on-screen tiles, and on-screen table all match the source CSV and the
independent hand calculation.

### Git commit
Step 2 commit — hash recorded in Step 3 entry / `git log`.
