# Agent Performance Ledger

A static dashboard for agent leaderboards — Applications (grouped by `applied_date`)
and Disbursals (grouped by `disbursal_date`) — built to run directly on GitHub Pages,
no build step, no server.

## Logins

| Username | Password   | Access                                                        |
|----------|------------|----------------------------------------------------------------|
| `admin`  | `admin1234`| Full dashboard, status breakdown, amounts, and file upload     |
| `sales`  | `12345678` | Leaderboard only — agent name + count, no amounts, no upload   |

**Important:** this is a front-end-only gate. The passwords live in `app.jsx`, which
is public once the repo (or the deployed site) is visible. It stops casual browsing,
not a determined reader of the source. Don't put anything truly sensitive behind it.

## 1. Deploy to GitHub Pages

1. Create a new GitHub repository (public, or private if you're on a paid plan that
   supports Pages for private repos).
2. Add all the files in this folder to the repo root:
   ```
   index.html
   app.jsx
   styles.css
   .nojekyll
   data/app-data.json
   data/dis-data.json
   data/app-meta.json
   data/dis-meta.json
   README.md
   ```
3. Commit and push to the `main` branch.
4. In the repo, go to **Settings → Pages**.
5. Under **Build and deployment**, set **Source** to "Deploy from a branch", branch
   `main`, folder `/ (root)`. Save.
6. GitHub gives you a URL like `https://<username>.github.io/<repo-name>/` — it takes
   a minute or two to go live the first time.

The `data/*.json` files already included are pre-loaded from the two files you gave
me (`incentive_APP.xlsx`, `incentive_Dis.xlsx`), so the dashboard works immediately
with no upload needed.

## 2. How data updates work (important — read this)

GitHub Pages only serves static files — there's no database and no server to write
to. So "uploading" in the app works like this:

1. Log in as `admin` → **Upload Data**.
2. Choose the new `.xlsx` file. It parses right in your browser and shows a
   **local preview** (saved only in your browser's storage — nobody else sees it yet).
3. Click **Download app-data.json** (or `dis-data.json`).
4. In your repo, replace the matching file in `/data` with the one you just
   downloaded.
5. Commit and push.
6. GitHub Pages redeploys automatically (~30–90 seconds). Everyone who opens the
   site — including the `sales` login on any device — now sees the new data.

You can also just edit/replace the files in `/data` directly on github.com
(Add file → Upload files) without going through the Upload tab at all, if that's
easier for a monthly refresh.

## 3. Local testing (optional)

Because the app uses `fetch()` to load the JSON files, opening `index.html` directly
from disk (`file://`) will fail due to browser CORS rules. Serve it locally instead:

```bash
cd agent-performance-ledger
python3 -m http.server 8000
# then open http://localhost:8000
```

or `npx serve .` if you have Node installed.

## File structure

```
index.html          entry point — loads React/Babel/SheetJS from CDN, then app.jsx
app.jsx              the dashboard (plain JSX, transformed in-browser by Babel)
styles.css           all styling
data/app-data.json   published Applications records  (agent, date, status, number)
data/dis-data.json   published Disbursals records     (agent, date, amt, number)
data/app-meta.json   last-published info for the Applications file
data/dis-meta.json   last-published info for the Disbursals file
.nojekyll            tells GitHub Pages not to run this through Jekyll
```

## Notes on scale

Babel is transforming JSX in the browser on every page load, which is fine for a
small internal tool like this but adds a bit of load time. If this ever needs to
feel snappier, the same `app.jsx` can be pre-compiled with a bundler (esbuild/Vite)
into plain JS — happy to set that up if it becomes worth it.
