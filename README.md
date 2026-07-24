# Agent Performance Ledger

A live dashboard for agent leaderboards — Applications (grouped by `applied_date`)
and Disbursals (grouped by `disbursal_date`). The site itself is static (hosted free
on GitHub Pages), but the data behind it lives in a free Firebase Firestore database,
so when admin publishes a new file, everyone sees it **instantly** — no redeploy, no
page refresh, no manual file-copying.

## Logins

| Username | Password   | Access                                                        |
|----------|------------|----------------------------------------------------------------|
| `admin`  | `admin1234`| Full dashboard, status breakdown, amounts, and file upload     |
| `sales`  | `12345678` | Leaderboard only — agent name + count, no amounts, no upload   |

**Important:** this is a front-end-only login gate. The passwords live in `app.jsx`,
readable by anyone who views the page source. It stops casual browsing, not a
determined reader of the source — don't put anything truly sensitive behind it.

## 1. One-time Firebase setup (~5 minutes)

This is the only setup step that involves an external service. It's free for a
dashboard this size (Firebase's free "Spark" plan covers far more reads/writes per
day than this will ever use).

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)** and
   sign in with any Google account.
2. Click **Add project** → give it any name (e.g. "agent-ledger") → you can skip
   Google Analytics → **Create project**.
3. In the left sidebar, click **Build → Firestore Database** → **Create database**
   → choose any region close to you → start in **production mode** → **Enable**.
4. Once it's created, click the **Rules** tab and replace the contents with:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /ledger/{docId} {
         allow read: if true;
         allow write: if true;
       }
     }
   }
   ```
   Click **Publish**. (This keeps it simple — anyone with your Firebase config can
   read or write the `ledger` collection, same trust level as the app's password
   gate. If that's ever a concern, Firebase Auth + tighter rules can restrict writes
   to signed-in admins — ask if you want that set up.)
5. Back in the project **Overview**, click the **`</>`** (web) icon to register a web
   app → give it any nickname → **Register app**. It'll show a code block with a
   `firebaseConfig` object like:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "agent-ledger-xxxx.firebaseapp.com",
     projectId: "agent-ledger-xxxx",
     storageBucket: "agent-ledger-xxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```
6. Open **`firebase-config.js`** in this folder and paste those exact values in,
   replacing the `PASTE_...` placeholders. Save.

That's it — no other file needs to change.

## 2. Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Add all the files in this folder to the repo root:
   ```
   index.html
   app.jsx
   styles.css
   firebase-config.js   ← with your real values filled in
   .nojekyll
   README.md
   ```
3. Commit and push to the `main` branch.
4. In the repo, go to **Settings → Pages** → under **Build and deployment**, set
   **Source** to "Deploy from a branch", branch `main`, folder `/ (root)` → Save.
5. Your site goes live at `https://<username>.github.io/<repo-name>/` within a
   minute or two.

## 3. Publishing data (this is now instant)

1. Log in as `admin` → **Upload Data**.
2. Choose the `.xlsx` file. It parses in your browser and shows you the row count.
3. Check the count looks right, then click **Publish live**.
4. Done — that data is now live for everyone, on any device, immediately. The old
   data for that file (Applications or Disbursals) is fully replaced.

The very first time you set this up, log in as admin and publish both
`incentive_APP.xlsx` and `incentive_Dis.xlsx` once each to seed the database — after
that, just repeat step 3 whenever there's a new export.

## 4. Local testing (optional)

The app still works if you just double-click `index.html` (the code is inlined, not
loaded from a separate file, so that part doesn't need a server). Firebase reads and
writes also work fine from a `file://` page since they're regular HTTPS calls to
Google's servers, not local file access. A local server is only needed if you want
to test from `localhost` instead:

```bash
cd agent-performance-ledger
python3 -m http.server 8000
# then open http://localhost:8000
```

## File structure

```
index.html            entry point — CDN scripts + the whole app inlined
app.jsx                readable source copy of the app (edit this, then re-inline
                        into index.html if you want to change the app itself)
styles.css             all styling
firebase-config.js      ← the one file you edit for setup, your project's keys
.nojekyll               tells GitHub Pages not to run this through Jekyll
```

## Notes

- Firestore documents cap out at 1 MiB; each dataset is stored as one JSON string,
  which comfortably covers several tens of thousands of rows before that's a concern.
- Babel transforms the JSX in-browser on every page load — fine for a small internal
  tool, but if it ever needs to feel snappier, `app.jsx` can be pre-compiled with a
  bundler (esbuild/Vite) into plain JS instead. Happy to set that up if it's worth it.
