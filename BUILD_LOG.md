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
Step 5 commit — hash recorded in Step 6 entry / `git log`.
