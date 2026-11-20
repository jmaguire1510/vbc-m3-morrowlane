# Module 3 Playbook Submission — Service Request Portal

**Name:** J.R. Maguire
**Live URL:** https://jmaguire-module3.netlify.app
**Repo:** https://github.com/jmaguire1510/vbc-m3-morrowlane

## What I built

*3–5 plain-English sentences about what you built and who it's for. No jargon — write it the way you'd explain it to a coworker who doesn't code.*

I built the behind-the-scenes part of Morrowlane's Service Request Portal, a single web page where Workplace Coordinators log client requests for Minneapolis, Chicago, Denver and Austin, set a priority, and update each request's status as the work moves along. The page itself was already designed; my job was to make it actually work. Requests now save and appear in one shared list with the newest at the top, and the three counters at the top (open requests, urgent open, completed this month) update on their own. The form turns away incomplete or invalid requests with a message that says exactly what to fix, and the Export CSV button downloads the whole list as a spreadsheet. Everything is kept in an online database, so requests are still there after a refresh and everyone sees the same list.

## Debug Log

*Document the bug you hit when your deployed site stopped behaving like your laptop. Fill in all five fields below. Keep it factual — what you saw, what you asked, what turned out to be true.*

**Symptom:** On my laptop, submitting a request worked: it saved, showed up at the top of the list, and was still there after a refresh. On the live Netlify site, clicking Submit showed "Could not save the request. Please try again." Nothing was added, and after refreshing, the list was still the same 22 starter requests. Changing a status from the dropdown failed the same way. Loading the list and the counters worked fine — only saving was broken.

**What I asked Claude:**

> STEP 7: Deploy and debug. Run npm run build. Push to GitHub and deploy to Netlify. DO NOT add Supabase yet. Test the live Save function and capture the REAL persistence failure/error. Document: Symptom, What I did, Expected result, Actual result, Error, Root cause. This failure is an intentional part of the assignment. Do not bypass it.

Claude tested the live site and reported back in that three-part form — what I did (submitted a fictional request and refreshed), what I expected (it saves and stays after a refresh, like on my laptop), and what actually happened (an error, and nothing saved). I then found the exact error in Netlify's logs and shared a screenshot: `EROFS: read-only file system, open '/var/task/data/entries.csv'`.

**Root cause:** On my laptop, the app runs as one ordinary program with a normal hard drive, so saving requests to a file worked. Netlify runs the behind-the-scenes code differently: short-lived copies start up when someone uses the site, from a locked, read-only copy of the project. The app simply isn't allowed to write a file there — that's what "read-only file system" means. And even if it could write somewhere, that copy disappears shortly afterwards, so the data would vanish anyway. The requests needed to live in a proper database outside Netlify.

**Fix:** I set up a table in Supabase that matches the request data and imported the 22 starter requests, then checked that the count and every value matched the original file exactly. I asked Claude to switch the app's saving and loading over to Supabase without changing how the page works, keeping the database key in Netlify's settings rather than in the code. After that, the live site still failed twice for setup reasons: the key's name in Netlify didn't match the name the code was looking for, and Netlify only picks up new settings on a fresh deploy. Claude made the code accept Supabase's name for the key, and we ran a new deploy.

**Verification:** On the live site I submitted a fictional request ("Morgan Livecheck"), refreshed, and it was still at the top. I changed its status to In Progress and refreshed again — the change stuck. The same row showed up in the Supabase table, the counters went up correctly, and the CSV export included it with the new status. Supabase's own logs showed the save arriving from Netlify and succeeding. In the final check, a new request ("Step11 Final Check") also saved and stayed after a refresh.

*Note: After verification, all test entries (including "Morgan Livecheck" and "Step11 Final Check") were deleted from the live database. The site now shows only the original 22 requests.*

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

**Where AI moved fast**
AI was fastest on the build work. I gave it the API rules from the README and it had the endpoints for loading, saving, validating and exporting requests working in minutes. It built the database table straight from the starter spreadsheet, so I didn't have to retype 22 records, and it kept a log of every test as it went.

**Where it went almost right**
The clearest example was the long-name test. A 199-character name with no spaces pushed the status dropdowns off the screen. The first fix made the table fit, and the measurements said it was solved. The screenshot showed otherwise: words like "Minneapolis" and "Medium" were split in half. We only caught it by looking at the actual page. Limiting the fix to the two free-text columns solved it.

Deployment followed the same pattern. The Supabase settings looked correct in Netlify, but the live site kept failing. The variable name didn't match what the code expected, and new settings only took effect after a fresh deploy. Supabase's logs showed the live site wasn't reaching the database at all, which pointed us to the cause.

**What I'd prompt differently**
I'd ask for a screenshot check after every visual change instead of trusting the numbers. I'd give the exact setting names up front, and I'd make "redeploy after changing a setting" part of the checklist. Working one step at a time with evidence at each stage worked well, and I'd do that again.
