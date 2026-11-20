# Module 3 Playbook Submission — Service Request Portal

**Name:** [YOUR NAME]
**Live URL:** [YOUR NETLIFY URL]
**Repo:** [YOUR GITHUB REPO URL]

## What I built

*3–5 plain-English sentences about what you built and who it's for. No jargon — write it the way you'd explain it to a coworker who doesn't code.*

[YOUR DESCRIPTION]

## Debug Log

*Document the bug you hit when your deployed site stopped behaving like your laptop. Fill in all five fields below. Keep it factual — what you saw, what you asked, what turned out to be true.*

**Symptom:** [YOUR DESCRIPTION OF WHAT WENT WRONG — what you saw on screen, and how it differed from what happened locally]

**What I asked Claude:**

> [YOUR PROMPT — paste the actual three-part prompt you used: what you did, what you expected, what actually happened]

**Root cause:** [YOUR EXPLANATION IN PLAIN ENGLISH — what was really happening underneath, in your own words]

**Fix:** [YOUR FIX — the steps you took, and what you asked Claude to change]

**Verification:** [YOUR VERIFICATION — what you did on the live site to prove the bug was actually gone, not just quiet]

## Test pass results

*Run all five checks against your live site and record what happened. "Result" is pass or fail plus what you actually saw. "Fix made" is what you changed, or "None needed."*

| # | Check | What I did | Result | Fix made |
|---|---|---|---|---|
| 1 | Valid entry | Submitted "Step10 Happy Path" (Minneapolis, Medium, ceiling tiles) on the live site, then refreshed the page. | **Pass.** "Request submitted." The request appeared at the top of the table, Open requests went from 10 to 11, and it was still there after the refresh. | None needed. |
| 2 | Empty form | Clicked Submit with every field blank, then with only spaces in the name, then filling in one field at a time. | **Pass.** Each try was refused with a clear message naming the missing field ("Requester name is required.", "Location is required.", "Description is required."). Nothing was saved; the table still had the same number of rows after a refresh. | None needed. |
| 3 | Duplicate-ish | Submitted the exact same request twice, then double-clicked Submit quickly on a third copy. | **Pass (works as specified).** Both identical submissions were saved as separate requests; the app has no rule against duplicates. The quick double-click only sent one request, because the button locks while saving. | None. Listed under Known limitations. |
| 4 | Absurd values | Tried a name containing web-page code, a name with accents and emoji, a description that looks like a spreadsheet formula, a 199-character name with no spaces, and a 500-character description with no spaces. | **Failed, then fixed.** Code in a name showed up as plain text and did nothing (safe). Accents and emoji looked right. But the one long name stretched the table about four times wider than the page and pushed the Status dropdowns off-screen for every request. After the fix, the long name wraps inside its own column and every dropdown is visible on the live site. | Let long text wrap inside the Requester and Description columns only. My first try wrapped every column and split short words like "Minneapolis" in half, so I narrowed it. |
| 5 | Hand-checked tile math | Marked one test request Complete, downloaded the live CSV, and counted the three tile numbers by hand; checked them again directly in the database. | **Pass.** The app showed 18 open, 3 urgent open, 1 completed this month. My count from the CSV and the database count were both 18, 3 and 1. | None needed. |

## Known limitations

*Be honest. List 3–5 things your app can't do or doesn't protect against, one bullet each — the things you'd want a real user to know before trusting it.*

- **No logins.** Anyone with the link can add requests and change any request's status, and there is no record of who made a change.
- **Duplicates aren't caught.** Submitting the same request twice creates two separate requests.
- **"Completed this month" doesn't track completion dates.** It counts requests *created* in the newest month that are now Complete, so a July request finished in August isn't counted for August, and the tile drops to 0 whenever a request from a new month arrives.
- **The table doesn't fit on a phone screen.** On a phone you have to scroll sideways to reach the Status column (this was true of the starter page too).
- **Spreadsheet-formula text isn't neutralized in the CSV export.** A description that starts with "=" could be treated as a formula if the file is opened in Excel.

## Assessment

*Around 250 words, first person. Where did AI move fast for you? Describe one genuine almost-right moment — something that looked correct and wasn't — and how you caught it. What would you prompt differently next time?*

[YOUR ASSESSMENT]
