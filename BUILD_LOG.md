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
`c7f83ba` — Step 2: Add GET /api/requests and GET /api/summary from seed CSV
(pushed; GitHub access was restored before this push).

---

## STEP 3 — Save entries (local storage)

**Date:** 2026-11-20

### Starting state
- Step 2 committed (`c7f83ba`). `GET /api/requests` and `GET /api/summary` read
  `data/seed-requests.csv` (read-only; ids assigned by row order).
- `app/api/requests/route.js` exports only `GET`.

### Objective
Implement `POST /api/requests` with **local file storage** (no Supabase). New
records get a generated id and `created_at`, status `New`, and HTTP 201. Verify the
entry appears, summaries update, and the record is in the local file.

### Evidence before change
```
BEFORE: POST /api/requests -> HTTP 405
```
(Route now exists from Step 2 but has no POST handler → 405 Method Not Allowed,
where Step 1 showed 404 because there was no route at all.)

### Storage approach
- Local file **`data/entries.csv`** (the file name the course checklist asks you to
  check). Columns: `id,created_at,requester_name,location,description,priority,status`.
- On the first save, the 22 seed rows are copied into `entries.csv` with ids 1–22
  (the same ids Step 2 assigned), then the new row is appended. From then on,
  `entries.csv` is the source of truth; `seed-requests.csv` is never modified.
- New id = highest existing id + 1. `created_at` = current UTC time, ISO format
  without milliseconds (matches the seed format).
- `data/entries.csv` is added to `.gitignore`, so test entries saved on a
  developer machine are never committed.

### Files changed
| File | Why |
|---|---|
| `lib/requests-store.js` | Reads `entries.csv` when present (else seed); new `createRequest()` writes/appends to `entries.csv` |
| `lib/csv.js` | New `toCsvRow()` — quotes values containing commas, quotes, or line breaks |
| `app/api/requests/route.js` | New `POST` handler → 201 `{ "request": {...} }`, clean 500 on failure |
| `.gitignore` | Ignore `data/entries.csv` (local runtime data) |
| `docs/evidence/step3-save-entry.png` | Screenshot after saving |
| `BUILD_LOG.md` | Step 2 hash + Step 3 entry |

### Tests performed and results

**Browser form (Playwright)** — fictional entry: Jordan Testwell / Chicago /
`STEP 3 test: "Quiet room" door lock sticks, needs adjustment` / Urgent
(includes a comma and double quotes to exercise CSV escaping).

```
BEFORE tiles: 9 | 2 | 5 | rows: 22
POST status: 201
POST body: {"request":{"id":23,"created_at":"2026-11-20T02:00:42Z","requester_name":"Jordan Testwell","location":"Chicago","description":"STEP 3 test: \"Quiet room\" door lock sticks, needs adjustment","priority":"Urgent","status":"New"}}
FORM MESSAGE: Request submitted.
AFTER tiles: 10 | 3 | 0 | rows: 23
row 1: Nov 20, 2026 | Jordan Testwell | Chicago | STEP 3 test: "Quiet room" door lock sticks, needs adjustment | Urgent | (status select: New)
form cleared: true
AFTER RELOAD rows: 23 | row 1 requester: Jordan Testwell
```

**Local file after the save:**
```
data/entries.csv: 24 lines (header + rows)
id,created_at,requester_name,location,description,priority,status
1,2026-07-16T14:20:00Z,Dana Whitfield,Minneapolis,HVAC making noise in suite 400,High,Complete
...
22,2026-08-28T17:45:00Z,Alison Vo,Minneapolis,"Air conditioning in suite 220 is not cooling, staff moved to the open area",Urgent,New
23,2026-11-20T02:00:42Z,Jordan Testwell,Chicago,"STEP 3 test: ""Quiet room"" door lock sticks, needs adjustment",Urgent,New
```

**Second save (curl)** — Riley Sample / Austin / Low → `HTTP 201`, `id: 24`,
`status: "New"`. Last row of `entries.csv` = id 24 Riley Sample ✔.

| Check | Result |
|---|---|
| HTTP 201 | ✔ (both saves) |
| id generated | ✔ 23, then 24 |
| created_at generated | ✔ `2026-11-20T02:00:42Z`, `2026-11-20T02:00:55Z` |
| status = New | ✔ |
| Entry appears in table (top row, newest first) | ✔, and still there after page reload |
| Summaries update | open 9 → 10 → 11, urgent 2 → 3 (Jordan is Urgent) ✔; completed_this_month 5 → 0 (see below) |
| Stored locally | ✔ last row of `data/entries.csv` matches the submitted entry |
| Seed ids unchanged | ✔ rows 1–22 in `entries.csv` match seed values and ids |
| CSV escaping on write | ✔ comma and `"` round-trip correctly |
| Malformed JSON body | `500 {"error":"Could not save the request. Please try again."}` (clean JSON, no crash) |
| `npm run build` | ✔ compiled successfully, no warnings |

### Problems encountered
1. Dev-server log showed `Attempted import error: 'toCsvRow' is not exported from './csv'`.
2. After the save, **completed_this_month dropped from 5 to 0**.

### Resolution
1. Timing artifact: hot reload compiled `requests-store.js` in the moment before
   `toCsvRow` was added to `csv.js`. The saves after it succeeded, and a clean
   `npm run build` compiled with no errors or warnings. No change needed.
2. **Recorded, not changed (Step 4 is the calculation check).** This follows the
   README rule as written: "this month" is the month of the *most recent request in
   the data*. The new entry is dated Nov 2026, which moves "this month" from August
   to November, and no November requests are Complete → 0. Step 4 will verify it by
   hand and decide whether it is correct.

### Observations recorded for later (not fixed now)
- No validation yet: blank fields, bad locations, etc. are currently saved
  (Step 5). Malformed JSON currently returns 500; Step 5 should make it a 400.
- Saving relies on writing to the server's disk (`data/entries.csv`). That will not
  persist on Netlify — expected Step 7 failure.
- Id assignment reads then appends; two saves at the exact same moment could get
  the same id. Acceptable for local storage, replaced by the database in Step 9.
- Local `data/entries.csv` currently holds the 2 test entries (ids 23–24). It is
  git-ignored; deleting it resets the app to the seed data.

### Verification
Entry submitted through the real form returned 201, appeared at the top of the
table, survived a page reload, updated the tiles, and is the last row of
`data/entries.csv`.

### Git commit
`a5075df` — Step 3: Add POST /api/requests with local CSV storage

---

## STEP 4 — Verify a calculation by hand

**Date:** 2026-11-20

### Starting state
- Step 3 committed (`a5075df`). Tiles are calculated in `lib/summary.js`.
- Local `data/entries.csv` holds the 22 seed rows plus Step 3 test entries 23 and 24
  (both dated 2026-11-20, status New).
- Open question from Step 3: after the first save, `completed_this_month` dropped 5 → 0.

### Objective
Independently calculate `completed_this_month` from the source data, compare it with
the app, and fix and retest if they differ.

### Rule being checked (README)
> the number of requests with status `Complete` whose `created_at` falls in **the month
> of the most recent request in the data** — not the month it happens to be today.

### Evidence before change — independent hand calculation
Done with Python's built-in `csv` module directly on `data/seed-requests.csv` (no app
code involved):

```
Total rows: 22 | most recent created_at: 2026-08-28T17:45:00Z -> month 2026-08

All Complete rows:
  2026-07-16  Dana Whitfield    Complete
  2026-07-17  Marcus Ellery     Complete
  2026-07-20  Priya Raghunathan Complete
  2026-07-22  Tomas Beckley     Complete
  2026-07-24  Alison Vo         Complete
  2026-07-27  Devon Ruiz        Complete
  2026-07-29  Hannah Sorensen   Complete
  2026-07-31  Curtis Nakamura   Complete
  2026-08-03  Renata Oyelaran   Complete  <-- counts
  2026-08-04  Grant Pemberton   Complete  <-- counts
  2026-08-06  Sofia Marchetti   Complete  <-- counts
  2026-08-07  Isaac Fontaine    Complete  <-- counts
  2026-08-10  Dana Whitfield    Complete  <-- counts

HAND RESULT (seed): completed_this_month = 5
```

Month-boundary / time-zone check: the only row near a month edge is
`2026-07-31T17:26:00Z` (12:26 pm Central, 11:26 am Mountain). It is July in UTC and in
every US time zone, so the UTC month comparison can't misplace it.

### Tests performed and results

| Scenario | Data | Hand calculation | App (`GET /api/summary`) | Match |
|---|---|---|---|---|
| A | Seed only (`entries.csv` moved aside temporarily) | month 2026-08 → open 9, urgent 2, **completed 5** | `{"open_requests":9,"urgent_open":2,"completed_this_month":5}` | ✔ |
| B | Current local data (seed + Nov test entries 23, 24) | month 2026-11 → open 11, urgent 3, **completed 0** | `{"open_requests":11,"urgent_open":3,"completed_this_month":0}` | ✔ |
| C | Controlled: id 23 hand-edited to `Complete` | month 2026-11 → open 10, urgent 2, **completed 1** | `{"open_requests":10,"urgent_open":2,"completed_this_month":1}` | ✔ |

After the test, `entries.csv` was restored from a backup (`cmp` confirmed identical) and
the app returned `{"open_requests":11,"urgent_open":3,"completed_this_month":0}` again.

### Files changed
| File | Why |
|---|---|
| `BUILD_LOG.md` | Step 3 hash + Step 4 entry |

No application code was changed — the calculation matched in every scenario.

### Problems encountered
- The 5 → 0 drop seen in Step 3 looked like a bug at first.

### Resolution
- Not a bug. The hand calculation shows it is exactly what the README rule produces:
  once a November request exists, "this month" becomes November, and no November
  requests are Complete. Scenario C proves the app counts correctly when one is.
- No code change, so no new requirement was invented to make the number "look nicer".

### Observations recorded for later (not fixed — would change the specified rule)
- The tile counts requests that were *created* in the latest month and are now
  Complete. There is no "completed date" column, so a July request finished in August
  does not count as "completed in August". This is a limitation of the data model and
  is worth listing under Known limitations.
- Any new request moves "this month" to the current month, so the tile resets to 0
  until something from that month is marked Complete. Worth explaining to users.

### Verification
Three independent hand calculations (seed, current data, controlled edit) all match
the app's output exactly.

### Git commit
`8ae37e7` — Step 4: Hand-verify completed_this_month against source data

---

## STEP 5 — Add server-side validation

**Date:** 2026-11-20

### Starting state
- Step 4 committed (`8ae37e7`). `POST /api/requests` saves whatever it receives;
  malformed JSON returns 500.
- The browser dropdowns and `maxLength={500}` are front-end only.

### Objective
Enforce the README rules on the server: all four fields required after trimming,
location/priority limited to the allowed values, description ≤ 500 characters. Reject
with HTTP 400 and a field-specific message; invalid records must not be saved; valid
records still return 201.

### Evidence before change
Run with `curl` against a backed-up copy of `data/entries.csv` (restored afterwards):
```
BEFORE rows: 24
blank form:
{"request":{"id":25,...,"requester_name":"","location":"","description":"","priority":"","status":"New"}}  <- HTTP 201
invalid location:
{"request":{"id":26,...,"requester_name":"X","location":"Paris","description":"y","priority":"Low","status":"New"}}  <- HTTP 201
AFTER rows: 26
25,2026-11-20T02:04:43Z,,,,,New
26,2026-11-20T02:04:43Z,X,Paris,y,Low,New
restored entries.csv (rows: 24)
```
A completely blank request and a made-up location were both saved.

### Files changed
| File | Why |
|---|---|
| `lib/validation.js` | New — `validateNewRequest()` with the allowed locations/priorities and 500-char limit |
| `app/api/requests/route.js` | POST parses JSON safely (400 if malformed), validates, saves trimmed values |
| `docs/evidence/step5-validation-error.png` | Screenshot of the empty-form error shown in the page |
| `BUILD_LOG.md` | Step 4 hash + Step 5 entry |

### Changes made
- Fields are checked in form order (name, location, description, priority); the first
  problem is returned as `{ "error": "..." }`, matching the README's single-message shape.
- Values are trimmed and the **trimmed** values are what gets saved.
- Location and priority must match exactly (case-sensitive), per README "exactly".
- Non-text values (e.g. a number) and non-object bodies are rejected with 400.
- Malformed JSON is now a 400 (it was a 500 in Step 3).

### Tests performed and results (curl)

| # | Test | HTTP | Message | Rows after |
|---|---|---|---|---|
| 1 | Blank form | 400 | Requester name is required. | 24 |
| 2 | Missing field (no priority) | 400 | Priority is required. | 24 |
| 3 | Whitespace-only name | 400 | Requester name is required. | 24 |
| 4 | Whitespace-only description (`" \n\t "`) | 400 | Description is required. | 24 |
| 5 | Invalid location `Paris` | 400 | Location must be Minneapolis, Chicago, Denver, or Austin. | 24 |
| 6 | Wrong-case location `denver` | 400 | Location must be Minneapolis, Chicago, Denver, or Austin. | 24 |
| 7 | Invalid priority `Critical` | 400 | Priority must be Low, Medium, High, or Urgent. | 24 |
| 8 | Description 501 chars | 400 | Description must be 500 characters or fewer (it is 501). | 24 |
| 9 | Name sent as a number | 400 | Requester name must be text. | 24 |
| 10 | Malformed JSON | 400 | Request body must be valid JSON. | 24 |
| 11 | JSON array body | 400 | Request body must be a JSON object with the request fields. | 24 |
| 12 | Valid, padded with spaces | **201** | id 25, saved as `Casey Fictional` / `STEP 5 valid test - replace hallway ceiling tile` (trimmed), status New | 25 |
| 13 | Valid, description exactly 500 chars (boundary) | **201** | id 26, status New | 26 |

**Browser form (Playwright):**
```
start rows: 26
Empty form: HTTP 400 | message: "Requester name is required." | rows: 26
Whitespace-only name: HTTP 400 | message: "Requester name is required." | rows: 26
Valid entry: HTTP 201 | message: "Request submitted." | rows: 27
top row: Nov 20, 2026 | Avery Placeholder | Denver | STEP 5 browser valid test - restock printer paper | Low
```
The browser console shows `Failed to load resource: ... 400 (Bad Request)` for the
rejected submissions — the browser's standard notice for any 4xx response, not an app error.

`npm run build`: compiled successfully, no warnings.

### Problems encountered
- Initially exported a `STATUSES` list from `lib/validation.js`; it is only needed by
  PATCH (Step 6).

### Resolution
- Removed it before testing to keep this step's scope to POST validation.

### Observations recorded for later (not fixed now)
- The page now shows the server's real message; the misleading "Could not reach the
  server" from Step 1 no longer appears for validation errors.
- Only the first error is reported at a time; a fully blank form needs several
  submissions to see every missing field. Matches the README's single-message format.
- Length is counted in JavaScript string units (same as the browser's `maxLength`), so
  some emoji count as 2 characters.
- Duplicate submissions are not blocked (no rule in README) — will be observed in Step 10.
- **Display issue seen in the Step 5 screenshot:** the valid 500-character test
  description (one unbroken word of `y`s) cannot wrap, so the table grows wider than
  its card and the Priority/Status columns are pushed off the right edge. Data is
  saved correctly; this is a layout problem with absurd input. Candidate for Step 10.
- Local `data/entries.csv` now holds test rows 23–27 (git-ignored).

### Verification
Every invalid case returned 400 with a message naming the field, and the stored row
count did not change. Valid submissions (including the 500-character boundary) returned
201 and were saved with trimmed values.

### Git commit
`9aabdb9` — Step 5: Add server-side validation to POST /api/requests

---

## STEP 6 — CSV export and status updates

**Date:** 2026-11-20

### Starting state
- Step 5 committed (`9aabdb9`). GET/POST `/api/requests` and GET `/api/summary` work.
- No `app/api/export` or `app/api/requests/[id]` route.

### Objective
Implement `GET /api/export` (CSV, newest first, correct MIME type and download
filename, correct escaping) and `PATCH /api/requests/[id]` (valid status → 200,
invalid status → 400, unknown id → 404).

### Evidence before change
```
BEFORE: GET   /api/export      -> HTTP 404 text/html; charset=utf-8
BEFORE: PATCH /api/requests/22 -> HTTP 404 text/html; charset=utf-8
BEFORE browser: status dropdown -> PATCH /api/requests/22 HTTP 404 | table error: "Could not reach the server. Please try again." | dropdown now: New
```

### Files changed
| File | Why |
|---|---|
| `app/api/export/route.js` | New — CSV download |
| `app/api/requests/[id]/route.js` | New — PATCH status |
| `lib/requests-store.js` | `updateRequestStatus()`; shared `writeAllRecords()` helper (also used by first save); `COLUMNS` exported for the export |
| `lib/validation.js` | `STATUSES` + `validateStatusUpdate()` |
| `lib/csv.js` | `toCsv()` builds a full CSV document |
| `docs/evidence/step6-status-and-export.png` | Screenshot after status change |
| `BUILD_LOG.md` | Step 5 hash + Step 6 entry |

### Changes made
- **Export:** columns `id,created_at,requester_name,location,description,priority,status`;
  rows newest first (same order as the table); values containing commas, quotes or
  line breaks are quoted with inner quotes doubled; CRLF line endings (CSV standard).
  Headers: `Content-Type: text/csv; charset=utf-8`,
  `Content-Disposition: attachment; filename="morrowlane-requests.csv"`,
  `Cache-Control: no-store`.
- **UTF-8 byte-order mark** at the start of the file: the seed data contains an em dash
  ("Standing desk request — new hire…"), which Excel shows as garbled characters without
  it. Spreadsheet tools and Python's `utf-8-sig` handle it transparently.
- **PATCH:** validates the body first (400), then looks up the id (404 if missing or not
  a whole number), updates and rewrites `data/entries.csv`, returns 200 with the record.
  Uses `await params` (required by Next.js 15).

### Tests performed and results

**Export (curl + independent Python check)** — added one valid entry first (id 28,
`STEP 6 escaping test: "Room 5", east wing` + a line break + `Second line here`) to
exercise escaping.

```
HTTP/1.1 200 OK
cache-control: no-store
content-disposition: attachment; filename="morrowlane-requests.csv"
content-type: text/csv; charset=utf-8
first 3 lines (cat -A; M-oM-;M-? = BOM, ^M$ = CRLF):
M-oM-;M-?id,created_at,requester_name,location,description,priority,status^M$
28,2026-11-20T02:08:29Z,Quinn Escapetest,Chicago,"STEP 6 escaping test: ""Room 5"", east wing$
Second line here",Medium,New^M$
header: ['id', 'created_at', 'requester_name', 'location', 'description', 'priority', 'status']
CSV rows: 28 | API rows: 28
newest first: True
every value matches API (same order): True
escaping round-trip: 'STEP 6 escaping test: "Room 5", east wing\nSecond line here'
seed quoted-comma row: ['Water leak under the breakroom sink, floor 6']
em dash preserved: ['Standing desk request — new hire starts Aug 3']
```

**PATCH (curl):**

| Test | HTTP | Result |
|---|---|---|
| id 22 → `In Progress` | 200 | record returned; `entries.csv` row 22 changed `New` → `In Progress`; summary open 15, urgent 3, completed 0 |
| id 28 → `Complete` | 200 | summary open 14, urgent 3, **completed_this_month 1** (Nov request now Complete) |
| status `Done` | 400 | Status must be New, In Progress, or Complete. |
| status `complete` (lowercase) | 400 | same message |
| missing status `{}` | 400 | same message |
| malformed JSON | 400 | Request body must be valid JSON. |
| id `9999` | 404 | No request found with id 9999. |
| id `abc` | 404 | No request found with id abc. |
| File after all invalid PATCHes | — | unchanged (md5 identical), 28 rows |

**Browser (Playwright):**
```
tiles before: 14 | 3 | 1
Sofia (Aug 27, Low) before: New
PATCH /api/requests/21 -> HTTP 200 | table error: (none)
tiles after: 13 | 3 | 1
Sofia after reload: Complete
download filename: morrowlane-requests.csv | bytes: 3725 | Sofia row in file: 21,2026-08-27T14:12:00Z,Sofia Marchetti,Denver,Request a second recycling pickup each week,Low,Complete
```
Completed-this-month correctly stayed at 1: Sofia's request is from August, and the
latest month in the data is November (Step 4 rule).

`npm run build`: compiled successfully; routes `/api/export`, `/api/requests`,
`/api/requests/[id]`, `/api/summary` all `ƒ (Dynamic)`.

### Problems encountered
- `xxd` is not installed in this environment, so the hex check of the first bytes printed
  nothing.

### Resolution
- Used `cat -A` instead, which shows the BOM (`M-oM-;M-?`) and CRLF (`^M$`) directly.

### Observations recorded for later (not fixed now)
- **Spreadsheet formula injection:** a description starting with `=`, `+`, `-` or `@` is
  exported as-is, and Excel may treat it as a formula. Not in the README contract —
  candidate for Step 10 "absurd input" / Known limitations.
- PATCH and POST rewrite/append the local file; simultaneous updates could overwrite each
  other. Replaced by the database in Step 9.
- Local `data/entries.csv` now holds test rows 23–28 and status changes to 21, 22, 28
  (git-ignored).

### Verification
Export matches the API row-for-row and value-for-value, is newest first, downloads as
`morrowlane-requests.csv`, and escapes commas, quotes and line breaks correctly. Status
changes return 200, persist in the file and survive a page reload; invalid statuses
return 400 and unknown ids return 404 without changing any data.

### Git commit
`62ab666` — Step 6: Add CSV export and PATCH status updates

---

## STEP 7 — Deploy and debug the live app

**Date:** 2026-11-20 (UTC) / Nov 19, 2026 evening (UTC-5, the Netlify dashboard's time zone)

### Starting state
- Step 6 committed and pushed (`62ab666`) on branch `claude/vigilant-goodall-emkv66`.
- All five endpoints work locally. Storage = local file `data/entries.csv`.
- No Supabase. No Netlify configuration in the repo (Netlify auto-detects Next.js).

### Objective
Build, push, deploy to Netlify, test the live Save, and capture the **real** persistence
failure and its root cause. Do not work around it.

### What I did
1. `npm run build` locally → compiled successfully; all four API routes `ƒ (Dynamic)`.
   Checked the build trace files: `data/seed-requests.csv` is bundled with every API route,
   so the live site can read the seed data.
2. Confirmed GitHub branch `claude/vigilant-goodall-emkv66` is at `62ab666` (local = remote).
3. J.R. connected the GitHub repo in the Netlify dashboard and deployed the
   `claude/vigilant-goodall-emkv66` branch → **https://jmaguire-module3.netlify.app**
   (dashboard: "Public", "Deploys from GitHub with Next.js", published 9:25 PM UTC-5).
4. This cloud dev environment blocked all Netlify hosts, so a personal environment
   `vbc-m3-morrowlane` was created allowing only `jmaguire-module3.netlify.app` (approved by J.R.).
5. Tested the live site with a real browser (Playwright) and with `curl`.
6. J.R. opened Netlify **Analytics & metrics → Observability**, found the failed requests,
   and opened the server function log for the failed POST.

### Expected result
A fictional request (Taylor Livecheck / Austin / "STEP 7 live test - kitchen faucet
dripping" / Medium) saves with HTTP 201, appears at the top of the table, and is still
there after a refresh — the same as on the laptop.

### Actual result
**Symptom:** the red message "Could not save the request. Please try again." appears under
the form. The table stays at 22 rows and the tiles stay at 9 / 2 / 5; after a refresh,
nothing new is there. Changing a status from the dropdown fails the same way. Locally, both
actions worked.

Browser (Playwright) on the live site:
```
[network] GET /api/requests -> 200
[network] GET /api/summary -> 200
LOADED: tiles 9 | 2 | 5 | rows 22 | top row: Aug 28, 2026 | Alison Vo | Minneapolis
--- clicking Submit on LIVE site ---
[network] POST /api/requests -> 500
POST /api/requests -> HTTP 500 | content-type: application/json
[console.error] Failed to load resource: the server responded with a status of 500 (Internal Server Error)
POST response body: {"error":"Could not save the request. Please try again."}
FORM MESSAGE: Could not save the request. Please try again.
AFTER SUBMIT: tiles 9 | 2 | 5 | rows 22 | top row: Aug 28, 2026 | Alison Vo | Minneapolis
--- refreshing ---
AFTER REFRESH: tiles 9 | 2 | 5 | rows 22 | top row: Aug 28, 2026 | Alison Vo | Minneapolis
```
Screenshot: `docs/evidence/step7-live-save.png`

`curl` against the live site (test time `2026-11-20T02:29:09Z`):

| Request | Writes to file? | Live result |
|---|---|---|
| `GET /`, `/api/requests`, `/api/summary`, `/api/export` | No | 200 (22 rows, 9/2/5, CSV) |
| `POST` blank form | No (rejected by validation first) | 400 "Requester name is required." |
| `POST` valid entry | **Yes** | **500** "Could not save the request. Please try again." (`x-nf-request-id: 01M7VCJK3WJHFHTMN5G1HSEJ5S`) |
| `PATCH /api/requests/22` → In Progress | **Yes** | **500** "Could not update the status. Please try again." (`x-nf-request-id: 01M7VCJKQXJP9VHK7F0E27NXAE`) |
| `PATCH` status "Done" | No | 400 "Status must be New, In Progress, or Complete." |
| After all of the above | — | summary still `{"open_requests":9,"urgent_open":2,"completed_this_month":5}`, id 22 still `New` |

Pattern: **everything that only reads works; everything that writes to the data file fails.**

Netlify request log (Observability, UTC-5) — `docs/evidence/step7-netlify-request-log.png`:
```
21:28:55.572  500 POST  /api/requests      (browser save)
21:29:09.884  500 POST  /api/requests      (curl save)
21:29:10.315  400 POST  /api/requests      (blank form)
21:29:10.525  500 PATCH /api/requests/22   (status change)
21:29:10.756  400 PATCH /api/requests/22   (invalid status)
```

### Error (from Netlify's server function log)
`docs/evidence/step7-netlify-erofs-error.png` — "Next.js Server Handler", 21:29:09:
```
Nov 19, 09:29:09 PM: error  POST /api/requests failed: Error:
EROFS: read-only file system, open '/var/task/data/entries.csv'
    at async o (.next/server/app/api/export/route.js:1:8846)
    at async p (.next/server/app/api/export/route.js:1:8949)
    at async x (.next/server/app/api/requests/route.js:1:1814)
    at async k (.next/server/app/api/requests/route.js:1:4624)
    at async g (.next/server/app/api/requests/route.js:1:5627)
{
  errno: -30,
  code: 'EROFS',
  syscall: 'open',
  path: '/var/task/data/entries.csv'
}
```
(The `export/route.js` lines are only where the bundler placed the shared storage code;
the failing call came from `POST /api/requests`.)

### Root cause
On my laptop, the app runs as one long-lived server with a normal hard drive, so writing
`data/entries.csv` works and the file is still there next time. On Netlify, the back end
runs as **serverless functions**: short-lived copies of the code that start on demand, each
from the same read-only package (`/var/task/`). The project folder there is **read-only**
(`EROFS` = "read-only file system"), so the first attempt to create `entries.csv` is
refused and the save returns 500.

Even if the file were written somewhere writable (such as a temporary folder), it would
belong to one short-lived function copy and disappear when that copy shuts down or a
different copy answers the next request — which is the "saved, then vanished after a
refresh" version of the same problem. Either way, **a file on the server is not durable
storage on Netlify.** The data needs to live in a separate, hosted database (Supabase in
Steps 8–9).

### Files changed
| File | Why |
|---|---|
| `docs/evidence/step7-live-save.png` | Live site after the failed Save |
| `docs/evidence/step7-netlify-request-log.png` | Netlify request log showing the 500s |
| `docs/evidence/step7-netlify-erofs-error.png` | Netlify function log with the EROFS error |
| `BUILD_LOG.md` | Step 6 hash + Step 7 entry |

**No application code was changed** — the failure is intentional for this step and was not
worked around.

### Problems encountered
1. **This dev environment could not reach Netlify** (`api.netlify.com`,
   `*.netlify.app` blocked by the network policy: `403 Forbidden (agent proxy: no rule
   or network setting allows this host)`).
2. The first live check returned **HTTP 401** on every URL with a redirect to
   `app.netlify.com/edge-access?...` — Netlify visitor access protection (team login) was on.
3. The Netlify dashboard menus differ from older guides; logs were under
   **Analytics & metrics → Observability**, not "Logs → Functions".
4. The live page only shows the friendly message, not the underlying error.

### Resolution
1. J.R. deployed from the Netlify dashboard; a personal environment allowing only
   `jmaguire-module3.netlify.app` was created so the live site could be tested from here.
2. J.R. set the site to **Public**; the next check returned 200.
3. J.R. found the failed requests in Observability and opened the function log.
4. The server-side `console.error` in each route's catch block wrote the full error to
   Netlify's function log, which provided the exact `EROFS` message above.

### Observations recorded for later
- Deployed version: J.R. did not paste the deploy's branch/commit, but the live site behaves
  exactly like `62ab666` (CSV export exists, validation 400 messages match, PATCH exists).
  Confirm under **Deploys** before submitting.
- The README predicted "data will vanish after refresh". With this implementation the
  failure shows up earlier and more clearly — the write is refused outright — but the root
  cause is the same.

### Verification
Failure reproduced three ways (live browser, curl, Netlify's own request log), and the
exact error was read from Netlify's server function log. Read-only endpoints and validation
work live; only writes fail.

### Git commit
`36be250` — Step 7: Deploy to Netlify and document live Save failure (EROFS)

---

## STEP 8 — Create the Supabase database

**Date:** 2026-11-20

### Starting state
- Step 7 committed (`36be250`). Live site reads seed data but every write fails with `EROFS`.
- Supabase project **"jmaguire1510's Project"** (ref `pmegzqlmcaomayfzcpzu`, us-east-1,
  Postgres 17, status ACTIVE_HEALTHY) already existed. `public` schema: **no tables**
  (`list_tables` → `{"tables":[]}`).
- Access was through the Supabase connector in this session — no keys, passwords or
  connection strings were used, typed or stored.

### Objective
Create a Supabase table that matches the app's data, import the existing records, and
verify schema, column types, row count and sample records. SQL shown to J.R. before running.

### Evidence before change — data inspection
```
rows: 22 | columns: ['created_at', 'requester_name', 'location', 'description', 'priority', 'status']
created_at all ISO-8601 UTC 'Z': True | range: 2026-07-16T14:20:00Z -> 2026-08-28T17:45:00Z
requester_name: max length 17, any blank: False, any apostrophe: False
description: max length 74, any blank: False, any apostrophe: False
location {'Minneapolis': 7, 'Chicago': 5, 'Denver': 5, 'Austin': 5}
priority {'High': 5, 'Medium': 7, 'Urgent': 4, 'Low': 6}
status {'Complete': 13, 'In Progress': 6, 'New': 3}
non-ASCII chars present: ['—']
```

### Files changed
| File | Why |
|---|---|
| `supabase/schema.sql` | New — table, index, Row Level Security policies and permissions |
| `supabase/seed.sql` | New — 22-row import generated from `data/seed-requests.csv`, then id counter set to 22 |
| `BUILD_LOG.md` | Step 7 hash + Step 8 entry |

### Changes made (in Supabase)
`public.requests`:

| Column | Type | Rules |
|---|---|---|
| `id` | `bigint` identity, primary key | auto-numbered; import supplies 1–22 |
| `created_at` | `timestamptz` | not null, default `now()` |
| `requester_name` | `text` | not null, not blank |
| `location` | `text` | Minneapolis / Chicago / Denver / Austin |
| `description` | `text` | 1–500 characters after trimming |
| `priority` | `text` | Low / Medium / High / Urgent |
| `status` | `text` | default `New`; New / In Progress / Complete |

- Index `requests_created_at_idx` on `created_at desc` (newest-first lists).
- **Row Level Security on**, with policies for the public `anon` role: read, insert, update.
- **Column-level permissions for `anon`:** insert only the four form fields (the database
  sets id, created_at and status `New`), update only `status`, no delete or truncate.
- The app's validation rules are repeated as database CHECK constraints, so bad data is
  refused even if someone bypasses the app.

Applied as migrations `create_requests_table` and `grant_select_requests_to_anon`; seed
inserted with `supabase/seed.sql` (`setval` → 22).

### Tests performed and results

**Schema (information_schema):**
```
id bigint NOT NULL | created_at timestamp with time zone NOT NULL default now()
requester_name text NOT NULL | location text NOT NULL | description text NOT NULL
priority text NOT NULL | status text NOT NULL default 'New'::text
```

| Check | Supabase | Source CSV | Match |
|---|---|---|---|
| Row count | 22 | 22 | ✔ |
| id range / next id | 1–22 / 23 | — | ✔ |
| Status counts | Complete 13, In Progress 6, New 3 | same | ✔ |
| Location counts | Minneapolis 7, Chicago 5, Denver 5, Austin 5 | same | ✔ |
| Priority counts | Medium 7, Low 6, High 5, Urgent 4 | same | ✔ |
| Tile math in SQL | open 9, urgent open 2, completed this month 5 | 9 / 2 / 5 (Step 4 hand calc) | ✔ |
| Whole-table fingerprint (md5 of all 22 rows, all 6 fields, in order) | `0f3f942f9d0281c99bd74d9b793f50b1` | `0f3f942f9d0281c99bd74d9b793f50b1` (Python on the CSV) | ✔ identical |
| Sample rows | id 1 Dana Whitfield 2026-07-16T14:20:00Z Complete; id 3 "Standing desk request — new hire starts Aug 3" (em dash intact); id 6 "Water leak under the breakroom sink, floor 6" (comma intact); id 22 Alison Vo 2026-08-28T17:45:00Z Urgent New | same | ✔ |
| Security advisor | no issues | — | ✔ |
| Performance advisor | no issues | — | ✔ |

**Permission test as the public `anon` role** (inside a transaction forced to roll back):
```
1 SELECT: OK 22 rows
2 INSERT form fields: OK id=23 status=New
3 INSERT status=Complete: DENIED permission denied for table requests
4 INSERT location=Paris: DENIED new row for relation "requests" violates check constraint "requests_location_check"
5 UPDATE status: OK rows=1
6 UPDATE description: DENIED permission denied for table requests
7 UPDATE status=Done: DENIED new row for relation "requests" violates check constraint "requests_status_check"
8 DELETE: DENIED permission denied for table requests
```
After the test: 22 rows, id 22 still `New`, id 1 present, 0 test rows, fingerprint unchanged,
id counter reset to 22 (Postgres id counters are not rolled back, so the test had used 23).

### Problems encountered
1. **Real bug in my first SQL — the public role could not read the table.** The first
   permission test failed with:
   `ERROR: 42501: permission denied for table requests` (HINT: `GRANT SELECT ON public.requests TO anon`).
   The privilege report showed `anon` had only `REFERENCES, TRIGGER`. This Supabase project
   does not grant table access to `anon` automatically; my SQL created a "read" policy but
   never granted the underlying SELECT permission. The security advisor did **not** flag it.
   In Step 9 the app would have failed to load any data.
2. My first permission-test script began a transaction without an explicit rollback.
3. Test inserts use up an id even when rolled back.

### Resolution
1. Added `grant select on public.requests to anon;` to `supabase/schema.sql` and applied it
   (migration `grant_select_requests_to_anon`). Re-test: SELECT OK, all other rules as designed.
2. It errored before writing anything (verified: 22 rows, 0 test rows). Rewrote the test so it
   ends with a deliberate `raise exception`, which guarantees Postgres rolls everything back.
3. Reset the id counter with `setval(..., max(id))` → 22, so the first real request gets id 23.

### Observations recorded for Step 9 (not done now)
- Supabase returns `created_at` like `2026-07-16T14:20:00+00:00`; the API contract and seed use
  `...Z`. Normalize when connecting so the API and CSV export keep the same format.
- New entries must send only the four form fields; the database sets id, created_at and status.
- Use the project's public (anon / publishable) key on the server via environment variables
  `SUPABASE_URL` and `SUPABASE_ANON_KEY` (as in `.env.example`); never a service-role key.

### Verification
The table structure matches the app's record shape, the column types fit the data, all 22
records were imported and are identical to the CSV, the tile math is 9 / 2 / 5 in SQL, the
public role can do exactly what the app needs and nothing more, and both Supabase advisors
report no issues.

### Git commit
`5d8d36a` — Step 8: Create Supabase requests table and import seed data

---

## STEP 9 — Connect the app to Supabase

**Date:** 2026-11-20

> Step 9 uses **two commits**: (A) the code change plus local verification, pushed so Netlify
> can deploy it; (B) the live-site verification, which can only happen after (A) is deployed.

### Starting state
- Step 8 committed (`5d8d36a`). Supabase table `public.requests` holds the 22 seed rows.
- `lib/requests-store.js` reads/writes CSV files → live writes fail with `EROFS` (Step 7).

### Objective
Replace local file storage with Supabase using environment variables and the public
(anon/publishable) key, keeping the API contract unchanged, then verify locally and live.

### Evidence before change
- `.env.example`: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (placeholders only).
- `.gitignore` already ignores `.env` and `.env.local` (`git check-ignore -v .env.local` →
  `.gitignore:5:.env.local`). No code read any environment variables.
- Variable names have **no `NEXT_PUBLIC_` prefix**, so Next.js keeps them server-side only.
- This dev environment could not reach Supabase: `403 Forbidden (agent proxy: no rule or
  network setting allows this host)` for `pmegzqlmcaomayfzcpzu.supabase.co`.

### Credentials handling
- Project URL from the Supabase connector: `https://pmegzqlmcaomayfzcpzu.supabase.co`.
- The project has two public keys (legacy `anon` JWT and modern `sb_publishable_…`); both map
  to the `anon` role. Used the **publishable** key (Supabase's recommendation). **Not** the
  service-role key.
- The key lives only in `.env.local` (git-ignored, file mode 600) locally and in Netlify's
  environment variables live. It is not written in this log, code, or any committed file.

### Files changed
| File | Why |
|---|---|
| `lib/requests-store.js` | Rewritten for Supabase: same exported functions (`getAllRequests`, `createRequest`, `updateRequestStatus`, `COLUMNS`) and same record shape |
| `lib/csv.js` | Removed the now-unused CSV reader (`parseCsv`, `csvToObjects`); export writer kept |
| `package.json`, `package-lock.json` | Added `@supabase/supabase-js` pinned to `2.119.0` |
| `BUILD_LOG.md` | Step 8 hash + Step 9 entry |
| `.env.local` | Created locally with the URL and publishable key — **git-ignored, not committed** |

No route files or front-end files changed.

### Changes made
- `getAllRequests()` → `select` ordered by `created_at desc, id desc` (newest first in the DB).
- `createRequest()` → `insert` of only the four validated form fields; Supabase assigns
  `id`, `created_at` and `status = 'New'` (matches the Step 8 column permissions).
- `updateRequestStatus()` → `update({ status }).eq("id", id)`; no matching row → `null` → 404.
- Timestamps normalized from Supabase's `2026-07-16T14:20:00+00:00` /
  `...02.273691+00:00` to the contract's `2026-07-16T14:20:00Z`.
- Missing env vars or any Supabase error throws inside the route's try/catch → clean
  `500 {"error": "..."}` JSON.
- Server validation (Step 5) still runs before any database call.

### Tests performed and results (local dev server → real Supabase)

| Test | Result |
|---|---|
| `GET /api/requests` | 200, 22 rows, newest first, ids are integers, **every field identical to the CSV** including `...Z` dates |
| `GET /api/summary` | 200 `{"open_requests":9,"urgent_open":2,"completed_this_month":5}` |
| `POST` valid (padded name, quotes + commas) | **201** id 23, name trimmed, status New, `created_at` `2026-11-20T02:49:02Z` |
| `POST` blank name / location Paris | 400 with the Step 5 messages; nothing saved |
| Summary after save | open 10, urgent 2, completed 0 (Nov is now latest month — Step 4 rule) |
| `PATCH 23 → Complete` | 200; summary → open 9, urgent 2, completed_this_month 1 |
| `PATCH 23` status "Done" | 400 "Status must be New, In Progress, or Complete." |
| `PATCH 9999` / `PATCH abc` | 404 "No request found with id …" |
| `GET /api/export` | 200, `text/csv; charset=utf-8`, `attachment; filename="morrowlane-requests.csv"`, 23 rows identical to the API, quotes/commas escaped |
| Row in Supabase (via SQL) | id 23 present, status `Complete`, stored as `2026-11-20 02:49:02.273691+00` |
| Cleanup | Deleted test row 23 (`returning id 23 'Local Supabase Test'`), reset id counter → 22; table back to 22 rows, fingerprint `0f3f942f9d0281c99bd74d9b793f50b1` (identical to CSV) |
| `npm run build` | Compiled successfully; all API routes `ƒ (Dynamic)` |
| Secret scan | Key found in **0** files under `.next/static` (browser), **0** in `.next/server`, **0** committable files; legacy anon JWT in 0 files; `service_role` in 0 code lines |

### Problems encountered
1. First local run: every endpoint returned 500. Server log:
   `GET /api/summary failed: Error: Supabase select failed: TypeError: fetch failed`.
2. Two PATCH tests returned `308` instead of 200/400.
3. `npm audit` reports critical/high advisories in `next` (and its `postcss`, `sharp`).

### Resolution
1. Cause: this sandbox routes HTTPS through a proxy, and Node's built-in `fetch` ignores
   proxy settings unless `NODE_USE_ENV_PROXY=1` is set (documented in the sandbox's proxy
   notes; `curl` worked because it honors the proxy). Restarted the dev server with
   `NODE_USE_ENV_PROXY=1` — sandbox-only; Netlify connects directly. **No code change.** The
   500 itself confirmed the error handling works (clean JSON, no crash).
2. My test script's bug: it saved the POST reply plus my own `<- HTTP 201` note into the same
   file, so extracting the id failed and the PATCH went to `/api/requests/` (Next.js redirects
   the trailing slash → 308). Re-ran with id 23: 200 and 400 as expected. Not an app bug.
3. Pre-existing in the starter's Next.js version; not caused by `@supabase/supabase-js`.
   Out of scope for this step — recorded under Known limitations for later.

### Observations recorded for later
- Supabase returns at most 1,000 rows per request by default; the list and export would need
  paging beyond that.
- `data/entries.csv` (git-ignored) is no longer used; the local copy was moved out of the
  project. `data/seed-requests.csv` stays as the original source data.

### Git commit (A)
`84d3423` — Step 9 (A): Replace local CSV storage with Supabase

### Problem after (A): live site 500 — environment variable name mismatch
- After pushing (A), before any Netlify variables existed, the live site returned
  `500 {"error":"Could not load the summary. Please try again."}` on `/api/summary` and
  `/api/requests` (02:51:52Z) — expected, and confirms the clean error path in production.
- J.R. set the Netlify variables following Supabase's dashboard "connect" guide, which names
  the public key **`SUPABASE_PUBLISHABLE_KEY`**. The code (and the starter's `.env.example`)
  read **`SUPABASE_ANON_KEY`**, so the key was still "missing": live site still 500 at 02:56:59Z.
- J.R. could not edit the existing Netlify variables in the dashboard.
- **Security note:** while sharing the variable list, a Supabase **secret** key (`sb_secret_…`)
  was pasted into the AI chat. It is not used by the app, was not written to any file, and J.R.
  was advised to revoke it in Supabase (Project Settings → API Keys) and keep it out of Netlify.
- Supabase's guide also suggested installing `@supabase/server`; not needed (that package
  verifies logged-in users; this app has no logins and already uses `@supabase/supabase-js`).

**Fix (agreed with J.R.):** the store now accepts the public key under either name —
`SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE_KEY` — and `.env.example` documents both (no real
values). Missing both still throws a clear server-side error → clean 500 JSON.

| Local test | Result |
|---|---|
| Only `SUPABASE_PUBLISHABLE_KEY` set | `200 {"open_requests":9,"urgent_open":2,"completed_this_month":5}` |
| Only `SUPABASE_ANON_KEY` set | `200` same |
| Neither set | `500 {"error":"Could not load the summary. Please try again."}`; server log: `SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) must be set.` |
| `npm run build` + key scan | compiled; key in 0 browser files, 0 committable files; `sb_secret` in 0 committable files |

Files: `lib/requests-store.js` (key lookup), `.env.example` (documents the alternative name).

### Git commit (A2)
`7943bcc` — Step 9 (A2): Accept SUPABASE_PUBLISHABLE_KEY as the public key name

### Problem after (A2): live site still 500
- After (A2) auto-deployed, the live site still returned 500 (03:11:00Z and, after J.R.
  added the variables, 03:20:52Z).
- **Evidence from Supabase's own request logs** (queried through the Supabase connector):
  every request to `/rest/v1/requests` since 02:30Z came from this dev environment
  (caller "Anthropic, PBC"); **zero** came from Netlify. So the live code never reached
  Supabase — it stopped at the "must be set" check before calling it.
- A Netlify dashboard AI agent was tried; it reported it could not access the project's
  environment variables or deploy controls.
- J.R. created a short-lived Netlify personal access token and entered it in a secure
  credential form (the proxy attaches it to `api.netlify.com` requests; the value was never
  visible in the chat, code, or logs).

Netlify API findings (names/scopes only; values were never printed):
```
site: jmaguire-module3 | repo jmaguire1510/vbc-m3-morrowlane | branch claude/vigilant-goodall-emkv66 | cmd npm run build | dir .next
published deploy: 6affb909326727e5250adb81 | commit 7943bcc | state ready | at 2026-11-20T03:06:30.988Z
2 variable(s):
  SUPABASE_URL              scopes=['builds','functions','post_processing','runtime'] | all=https URL (matches project URL)
  SUPABASE_PUBLISHABLE_KEY  scopes=['builds','functions','post_processing','runtime'] | all=sb_publishable_…
Netlify key identical to locally tested key: True | surrounding whitespace: False
```
`SUPABASE_SECRET_KEY` was **not** present in Netlify.

**Root cause:** the variables were correct, but **no deploy had run since they were added**.
The published deploy (03:06:30Z) predated them, and Netlify only applies environment-variable
changes to the server functions on the next deploy.

**Fix:** triggered a production build through the Netlify API →
deploy `6affbd30cc4b609b80dc8339`, `state: ready`, `context: production`, branch
`claude/vigilant-goodall-emkv66`, commit `7943bcc`, published `2026-11-20T03:24:09.083Z`.

### Live verification (https://jmaguire-module3.netlify.app)

Reads (curl, 03:24:20Z):
```
{"open_requests":9,"urgent_open":2,"completed_this_month":5}  <- /api/summary HTTP 200
/api/requests -> HTTP 200   (cache-control: no-cache; Netlify Durable fwd=bypass)
rows: 22 | newest first: True | all 22 seed rows identical: True
```

Browser (Playwright) on the live site — fictional entry Morgan Livecheck / Chicago / High:
```
LOADED: tiles 9 | 2 | 5 | rows 22 | top: Aug 28, 2026 | Alison Vo | Minneapolis
  [network] POST /api/requests -> 201
POST body: {"request":{"id":23,"created_at":"2026-11-20T03:24:38Z","requester_name":"Morgan Livecheck","location":"Chicago","description":"STEP 9 live test - conference room door sticks, needs adjustment","priority":"High","status":"New"}}
FORM MESSAGE: Request submitted.
AFTER SAVE: tiles 10 | 2 | 0 | rows 23 | top: Nov 20, 2026 | Morgan Livecheck | Chicago
AFTER REFRESH: tiles 10 | 2 | 0 | rows 23 | top: Nov 20, 2026 | Morgan Livecheck | Chicago
entry status after refresh: New
  [network] PATCH /api/requests/23 -> 200
AFTER PATCH: tiles 10 | 2 | 0 | rows 23 | top: Nov 20, 2026 | Morgan Livecheck | Chicago
AFTER 2nd REFRESH: tiles 10 | 2 | 0 | rows 23 | top: Nov 20, 2026 | Morgan Livecheck | Chicago
entry status after 2nd refresh: In Progress
EXPORT: morrowlane-requests.csv | data rows: 23 | header: id,created_at,requester_name,location,description,priority,status
  row 1: 23,2026-11-20T03:24:38Z,Morgan Livecheck,Chicago,"STEP 9 live test - conference room door sticks, needs adjustment",High,In Progress
  last : 1,2026-07-16T14:20:00Z,Dana Whitfield,Minneapolis,HVAC making noise in suite 400,High,Complete
```
Screenshot: `docs/evidence/step9-live-saved.png`

Supabase (SQL): `id 23 | 2026-11-20 03:24:38.841638+00 | Morgan Livecheck | Chicago | … | High | In Progress | total_rows 23`.

Supabase request log since 03:24Z (`/rest/v1/requests`): callers "Amazon.com, Inc." /
"Amazon Technologies Inc." (Netlify's servers), key type `sb_publishable_…`:
GET 200 ×15, **POST 201 ×1**, **PATCH 200 ×1**.

| Requirement | Result |
|---|---|
| Existing data loads | ✔ 22 rows identical to source, tiles 9 / 2 / 5 |
| New entry saves | ✔ 201, id 23, status New |
| Survives refresh | ✔ still top row after refresh |
| Exists in Supabase | ✔ row 23 in `public.requests` |
| PATCH persists | ✔ New → In Progress, survives a second refresh, stored in Supabase |
| Summaries correct | ✔ open 9→10; urgent stays 2 (entry is High); completed_this_month 5→0 because Nov 2026 is now the latest month and has no Complete requests (Step 4 rule); PATCH to In Progress keeps open at 10 |
| CSV export correct | ✔ 23 rows, newest first, new entry with updated status at top, oldest (id 1) last |

**The Step 7 bug is fixed:** saves and status changes now persist on the live site.

### Follow-ups for J.R. (manual)
- Revoke the Supabase **secret** key that was pasted into the chat (Supabase → Project Settings
  → API Keys). It is not used anywhere.
- Delete the Netlify personal access token when no longer needed (Netlify → User settings →
  Applications), and optionally remove the saved credential from the `vbc-m3-morrowlane`
  cloud environment settings.
- (Correction made in Step 10: an earlier version of this list suggested deleting a "duplicate"
  Netlify variable. There is no duplicate — Netlify has exactly `SUPABASE_URL` and
  `SUPABASE_PUBLISHABLE_KEY`, both needed.)

### Git commit (B)
`0e9aeac` — Step 9 (B): Verify live Supabase persistence on Netlify

---

## STEP 10 — Five-part test pass on the live app

**Date:** 2026-11-20 (UTC). All tests against **https://jmaguire-module3.netlify.app**
(production deploy of `7943bcc`) with a real browser (Playwright) unless noted.
Test entries are named `Step10 …` so they can be identified later.

### Starting state
- Step 9 committed (`0e9aeac`). Live site on Supabase: 23 rows (22 seed + "Morgan Livecheck"),
  tiles 10 / 2 / 0.

### Objective
Try to break the live app with five checks (happy path, empty, duplicate, absurd, math),
record real bugs with symptom / root cause / fix / verification, without inventing requirements.

### Test 1 — Happy path ✔
```
before: 10 | 2 | 0 | rows 23
submit -> 201 Request submitted.
after : 11 | 2 | 0 | rows 24
after refresh: 11 | 2 | 0 | rows 24 | top row: Nov 20, 2026 | Step10 Happy Path | Minneapolis | Replace two ceiling tiles stained by an old leak in suite 310 | Medium
```

### Test 2 — Empty submission ✔
```
submit blank -> 400 Requester name is required. | rows 24 (was 24)
submit spaces-only name -> 400 Requester name is required.
submit name only -> 400 Location is required.
submit name+location -> 400 Description is required.
after refresh rows: 24 (was 24) | POST statuses: 400,400,400,400
```
Nothing saved. Messages name the field. Only one problem is reported at a time (README format).
Screenshot: `docs/evidence/step10-empty-form.png`.

### Test 3 — Duplicate ✔ (behaves as specified; recorded as a limitation)
```
1st submit -> 201 Request submitted.
2nd identical submit -> 201 Request submitted.
rapid double-click -> message: Request submitted.
POST statuses: 201,201,201 | rows 24 -> 27 | "Step10 Duplicate" rows in table: 3
```
- Two deliberate identical submissions both save — the README has no duplicate rule, so this is
  not treated as a bug (no requirement invented). Listed under Known limitations.
- A rapid double-click sent **one** request (the front end disables the button while
  submitting) — no accidental double save.

### Test 4 — Absurd values ✘ → real bug found and fixed
```
"Step10 <script>alert("x")</script><img s…" (62 chars) -> 201
"Step10 Zoë Ñúñez 🚀🔥" (21 chars) / "Accents and emoji: café ☕ — naïve résumé" -> 201
"Step10 Formula" / '=HYPERLINK("http://example.com","Click me")' -> 201
"Step10 UnbrokennameXXXX…" (199 chars, no spaces) -> 201
"Step10 Long Description" / 500 × "W" -> 201
layout: {"cardWidth":918,"tableWidth":3569,"pageScrollWidth":3770,"viewport":1280,"statusDropdownsOffscreen":32,"totalDropdowns":32}
script name shown as text: "Step10 <script>alert(\"x\")</script><img src=x onerror=alert(1)>" | dialogs fired: 0 | injected <img> elements in table: 0
emoji row: Step10 Zoë Ñúñez 🚀🔥 | Denver | Accents and emoji: café ☕ — naïve résumé
```
- Script/HTML in a name is displayed as plain text; no script ran (0 dialogs, 0 injected
  elements). ✔
- Accents and emoji save and display correctly. ✔
- The formula text is exported raw: `'=HYPERLINK("http://example.com","Click me")'`. Excel may treat
  it as a formula. Not covered by the README; recorded as a Known limitation (not changed).
- **BUG:** see below.

#### Bug — one long name breaks the whole table
- **Symptom:** after saving a 199-character requester name with no spaces (accepted — the README
  sets no name length limit), the Requester column stretched to fit it. The table grew to
  **3,569 px** inside a 918 px card; Location, Description, Priority and **all 32 Status
  dropdowns were pushed off-screen** for every row; the page scrolled sideways to 3,770 px.
  Screenshot: `docs/evidence/step10-absurd-layout-before.png`.
- **Root cause:** the table cells had no rule allowing very long words to break, so the browser
  widened the column to fit the whole "word". Descriptions are shortened to 80 characters for
  display, but requester names are not shortened at all.
- **Fix (first attempt — almost right):** added `overflow-wrap: anywhere` to every table cell.
  The table fit (878 px) and 0/32 dropdowns were off-screen — but the screenshot showed normal
  short values broken mid-word: "Minneap / olis" and the badge "Mediu / m", because the browser
  could now squeeze *every* column.
- **Fix (final):** applied the rule only to the two free-text columns, Requester (column 2) and
  Description (column 4), in `app/globals.css`. No other design change; no new validation rule.
- **Verification (local dev server reading the same live Supabase data):**

  | Measure (1280 px window) | Before | After |
  |---|---|---|
  | Table width (card is 918 px) | 3,569 px | **878 px** |
  | Page width (window 1,280 px) | 3,770 px | **1,280 px** (no sideways scroll) |
  | Status dropdowns off-screen | 32 / 32 | **0 / 32** |
  | Location cells split across lines | — | **0 / 32** (text-line measurement) |
  | Priority badges split across lines | — | **0 / 32** |

  Screenshot: `docs/evidence/step10-absurd-layout-after-local.png`. Live verification below.

- **Pre-existing, not fixed:** at phone width (390 px) the table is wider than the screen even with
  only the original 22 rows and **without** my change (581 px in a 348 px card; 531–559 px with
  the fix). The starter's six-column table was never designed for phones; fixing it would be a
  front-end redesign. Recorded as a Known limitation.

### Test 5 — Hand-checked tile math ✔
Marked "Step10 Happy Path" (id 24) Complete on the live site (`PATCH 24 → 200`) so
`completed_this_month` is non-zero, then calculated all three tiles by hand from the downloaded
live CSV (Python's `csv` module — independent of the app's summary code), and a third time in SQL:
```
APP TILES: {"open_requests":18,"urgent_open":3,"completed_this_month":1}
HAND CHECK from the downloaded live CSV:
total rows: 32
open_requests = rows not Complete = 18  (status counts: New 11, In Progress 7, Complete 14)
urgent_open   = not Complete AND Urgent = 3: id 32 Step10 Long Description; id 22 Alison Vo; id 15 Priya Raghunathan
completed_this_month: latest created_at = 2026-11-20T03:27:26Z -> month 2026-11; Complete in 2026-11 = 1: id 24 Step10 Happy Path
SUPABASE SQL: total_rows 32, open_requests 18, urgent_open 3, completed_this_month 1
```
App = hand calculation = database. ✔

### Files changed (commit A)
| File | Why |
|---|---|
| `app/globals.css` | Wrap long unbroken text in the Requester and Description cells only |
| `docs/evidence/step10-*.png` | Empty-form, before and after screenshots |
| `BUILD_LOG.md` | Step 9 (B) hash, correction, Step 10 entry |

### Problems encountered (test tooling)
- My first check for split words measured cell height, which is always the full row height in a
  table, so it falsely reported every Location as split. Re-measured the text's own line count:
  0 split. Not an app issue.

### Git commit (A)
`b192750` — Step 10 (A): Test pass on live app; fix table overflow from long text

### Live verification of the fix
Netlify published deploy `6affbf6031553d50530cab52` — production, branch
`claude/vigilant-goodall-emkv66`, commit `b192750`, `state: ready`, `2026-11-20T03:33:30.009Z`
(checked through the Netlify API).
```
LIVE after fix:
viewport 1280px: {"cardWidth":918,"tableWidth":878,"pageScrollWidth":1280,"dropdownsOffscreen":"0/32"}
viewport 390px: {"cardWidth":348,"tableWidth":559,"pageScrollWidth":600,"dropdownsOffscreen":"32/32"}
{"location_cells":32,"location_split":[],"priority_badges":32,"priority_split":[]}
tiles: {"open_requests":18,"urgent_open":3,"completed_this_month":1} | css served contains fix: 1
```
At 1280 px: table fits its card, no sideways scroll, every Status dropdown visible, no short
value split mid-word. Screenshot: `docs/evidence/step10-absurd-layout-after-live.png`.
The 390 px (phone) overflow is the pre-existing limitation noted above.

### SUBMISSION.md
Filled in the **Test pass results** table and **Known limitations** with the results above.
Name, URLs, What I built, Debug Log and Assessment are completed in Step 11.

Other limitations recorded (not in SUBMISSION.md's 3–5 list): the starter's Next.js version
has `npm audit` security advisories (Step 9); Supabase returns at most 1,000 rows per request
by default, so the list and export would need paging beyond that.

### Live data note
The live database now contains test entries: "Morgan Livecheck" (Step 9) and ten `Step10 …`
entries (Step 10). They are left in place as evidence; J.R. can decide in Step 11 whether to
remove them before submitting.

### Git commit (B)
Step 10 (B) — hash recorded in Step 11 entry / `git log`.
