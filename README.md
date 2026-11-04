# vishakaoga-web

Website for the **Visakha Vidyalaya Old Girls' Association (OGA)**, with three branches:
Kandy (KDY), Bandarawela (BDW) and Colombo (COL).

**Stack:** React (Vite) · Express · MongoDB Atlas · Cloudinary (photos, from step 2).
One Node app serves both the API and the website, so it runs as a single Render service.

## Build progress

- [x] **Step 1:** project setup, branches, login, committee roles
- [ ] Step 2: registration (incl. current profession) with photo crop, committee approval, QR membership card
- [ ] Step 3: events, "I'm attending", QR scanning at the gate
- [ ] Step 4: fund records per branch
- [ ] Step 5: posts, history pages, batch wall, Excel/PDF batch lists
- [ ] Step 6: go live on Render with the .lk domain

## Run it on your computer

You need **Node.js 20.6 or newer** (`node -v` to check) and a MongoDB Atlas free cluster.

```bash
git clone https://github.com/CharithShali/vishakaoga-web.git
cd vishakaoga-web
npm install
```

Make your settings file: copy `.env.example` to `.env` (Windows: `copy .env.example .env`)
and fill in:

| Setting | Where to get it |
| --- | --- |
| `MONGODB_URI` | Atlas → your cluster → **Connect** → **Drivers**. Keep `/vishakaoga` before the `?`. Also allow your IP under **Network Access**. |
| `JWT_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste the result |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Your own login for the first main admin account |

Then create the branches and your admin account, and start the site:

```bash
npm run seed        # 3 branches + your admin account (safe to run again)
npm run seed:demo   # optional: test members, e.g. kandy.coordinator@demo.lk
npm run dev         # starts the server (port 5000) and the website (port 5173)
```

Open **http://localhost:5173** and log in with your admin email. Commit the
`package-lock.json` that `npm install` creates.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Server and website together, reloading on changes |
| `npm run seed` | Creates the branches and the main admin |
| `npm run seed:demo` | Adds test members (refused when `NODE_ENV=production`) |
| `npm test` | Runs the server unit tests |
| `npm run build` | Builds the website into `client/dist` |
| `npm start` | Runs the server, which also serves the built website |

## How roles work

Every approved member can log in. Committee jobs are extra **roles**, and each role is
either for **all branches** or for **one branch**:

| Role | Can do (now and in later steps) |
| --- | --- |
| Main admin | Everything, including giving and removing roles |
| Branch coordinator | Approve registrations and see member lists for her branch |
| Secretary | Member lists, posts and events (for one branch or all) |
| Treasurer | Fund records (for one branch or all) |
| Event helper | Scan QR cards at events |

The server checks every request (`server/src/utils/permissions.js`). The page only
hides menus and buttons; it never decides what someone may do.

## Project layout

```
client/                 React website (Vite)
  src/pages/            One file per page
  src/auth/             Login state and role helpers
server/
  src/models/           MongoDB models: Branch, User
  src/routes/           API: /api/auth, /api/branches, /api/users
  src/middleware/       Login cookie, role checks, input validation
  src/utils/            Permission rules (+ tests)
  scripts/seed.js       Branches + first admin
.env.example            Settings template (copy to .env)
```

## API so far

| Method | Path | Who |
| --- | --- | --- |
| GET | `/api/branches` | Anyone |
| POST | `/api/auth/login` · `/api/auth/logout` | Anyone |
| GET | `/api/auth/me` | Anyone (returns `user: null` when logged out) |
| POST | `/api/auth/change-password` | Logged-in members |
| GET | `/api/users?branch=&status=` | Secretary / coordinator (own branch only) / admin |
| PUT | `/api/users/:id/roles` | Main admin |

## Deploying on Render (step 6)

- Build command: `npm install --include=dev && npm run build`
- Start command: `npm start`
- Environment: the same values as `.env`, plus `NODE_ENV=production`
