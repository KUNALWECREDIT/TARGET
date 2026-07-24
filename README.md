# Agent Performance Ledger

A dashboard for agent leaderboards — Applications (grouped by `applied_date`) and
Disbursals (grouped by `disbursal_date`) — that runs entirely on GitHub, free:
GitHub Pages hosts the site, and the data itself lives as JSON files in this same
repo. Publishing a new file pushes straight to GitHub from the browser — no other
service, no signup anywhere else.

## Logins

| Username | Password   | Access                                                        |
|----------|------------|----------------------------------------------------------------|
| `admin`  | `admin1234`| Full dashboard, status breakdown, amounts, and file upload     |
| `sales`  | `12345678` | Leaderboard only — agent name + count, no amounts, no upload   |

**Important:** this is a front-end-only login gate. The passwords live in `app.jsx`,
readable by anyone who views the page source. It stops casual browsing, not a
determined reader of the source — don't put anything truly sensitive behind it.

## 1. Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Add all the files in this folder to the repo root:
   ```
   index.html
   app.jsx
   styles.css
   .nojekyll
   README.md
   data/app-data.json
   data/dis-data.json
   ```
3. Commit and push to the `main` branch.
4. In the repo, go to **Settings → Pages** → under **Build and deployment**, set
   **Source** to "Deploy from a branch", branch `main`, folder `/ (root)` → Save.
5. Your site goes live at `https://<username>.github.io/<repo-name>/` within a
   minute or two. `data/app-data.json` and `data/dis-data.json` already contain the
   two files you originally gave me, so it works immediately.

## 2. One-time token setup, so Publish works (~2 minutes)

Reading the dashboard needs nothing extra. But to let the **admin** login push new
data straight to GitHub (instead of downloading a file and uploading it manually),
admin needs a personal access token, entered once in the app:

1. On GitHub, go to **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. Give it any name (e.g. "ledger-publish"), set an expiration you're comfortable
   with (e.g. 1 year — you can regenerate it any time).
3. Under **Repository access**, choose **Only select repositories** and pick this
   repo.
4. Under **Permissions → Repository permissions**, set **Contents** to
   **Read and write**. Leave everything else as "No access".
5. Click **Generate token** and copy it (GitHub only shows it once).
6. On the deployed site, log in as `admin` → **Upload Data** → in the **Publishing
   destination** card at the top, fill in:
   - **Repo owner** — your GitHub username (or org name)
   - **Repo name** — the repo you created above
   - **Branch** — `main`
   - **Personal access token** — the one you just generated
   
   Click **Save settings**. This is stored only in that browser's local storage —
   it is never written into the repo, so it stays private to that device.

**About this token:** it's a real credential with write access to this one repo.
Treat it like a password — don't paste it into a shared/public computer, and if it's
ever exposed, revoke it immediately from the same GitHub settings page and generate
a new one. Because it's scoped to just this repo and just "Contents: Read and
write," the worst case if it leaked is someone editing files in this repo — it
can't touch anything else in your GitHub account.

## 3. Publishing a new sheet

1. Log in as `admin` → **Upload Data**.
2. Choose the `.xlsx` file. It parses in your browser and shows you the row count.
3. Check the count looks right, then click **Publish**.
4. That commits the new data straight to `data/` in your repo, replacing the old
   file entirely. GitHub Pages then rebuilds automatically — usually live for
   everyone within 30–90 seconds. Every open tab also re-checks every 30 seconds on
   its own, so no one needs to manually refresh to see it, though the refresh icon
   in the top bar forces an immediate check if you don't want to wait.

## 4. Local testing (optional)

The app works if you just double-click `index.html` — the code is inlined, not
loaded from a separate file. Reading data from `data/*.json` and publishing via the
GitHub API both work fine from a `file://` page too, since they're regular HTTPS
calls, not local file access. A local server is only needed if you'd rather test
from `localhost`:

```bash
cd agent-performance-ledger
python3 -m http.server 8000
# then open http://localhost:8000
```

## File structure

```
index.html             entry point — CDN scripts + the whole app inlined
app.jsx                 readable source copy of the app (edit this, then re-inline
                         into index.html if you want to change the app itself)
styles.css               all styling
.nojekyll                 tells GitHub Pages not to run this through Jekyll
data/app-data.json        published Applications records + metadata
data/dis-data.json        published Disbursals records + metadata
```

## Notes

- GitHub's unauthenticated API rate limit doesn't apply here — reads happen via the
  deployed site itself (a plain file fetch, no limit that matters at this scale).
  Publishing uses your token, which gets 5,000 authenticated requests/hour — far
  more than a dashboard like this will ever need.
- Because this isn't a real database, two admins publishing to the *same* file
  within the same few seconds could rarely conflict (whoever saves last wins,
  same as editing any file on GitHub). Not a concern for occasional monthly/weekly
  updates.
- Babel transforms the JSX in-browser on every page load — fine for a small internal
  tool, but if it ever needs to feel snappier, `app.jsx` can be pre-compiled with a
  bundler (esbuild/Vite) into plain JS instead. Happy to set that up if it's worth it.
