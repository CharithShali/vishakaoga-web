# vishakaoga-web

Website for the **Visakha Vidyalaya Old Girls' Association (OGA)**, with three branches:
Kandy (KDY), Bandarawela (BDW) and Colombo (COL).

**Stack:** React (Vite) · Express · MongoDB Atlas · Cloudinary (photos, from step 2).
One Node app serves both the API and the website, so it runs as a single Render service.

## Build progress

- [x] **Step 1:** project setup, branches, login, committee roles
- [x] **Step 2:** registration (incl. current profession) with photo crop, committee approval, QR membership card
- [x] **Step 3:** events, "I'm attending", QR scanning at the gate, attendance lists
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
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary → **Settings** → **API Keys** (needed for member photos) |

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
  src/models/           MongoDB models: Branch, User, Counter
  src/services/         Photo resize + Cloudinary
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
| GET | `/api/users?branch=&status=&q=&role=` (q: name, member no., email or batch year; role: `committee:any`, `committee:<role>`, `school:<role>`) | Secretary / coordinator (own branch only) / admin |
| PUT | `/api/users/:id/roles` | Main admin |
| POST | `/api/users/:id/remove` `{ reason }` · `/api/users/:id/restore` | Main admin |
| DELETE | `/api/users/:id` (only removed or rejected members; photo deleted too) | Main admin |
| POST | `/api/registrations` | Anyone (multipart: `data` JSON + `photo`) |
| GET | `/api/registrations?branch=` | Coordinator (own branch) / secretary / admin |
| POST | `/api/registrations/:id/approve` · `/reject` | Coordinator or secretary of that branch / admin |
| GET | `/api/members/me` | Logged-in members (card details) |
| GET | `/api/events?when=upcoming\|past&branch=` · `/api/events/:id` | Anyone (a branch filter includes joint events) |
| POST · PUT · DELETE | `/api/events` · `/api/events/:id` | Coordinator (own branch) / secretary / admin; joint events need a central role |
| POST · DELETE | `/api/events/:id/rsvp` | Logged-in members ("I'm attending") |
| GET | `/api/events/:id/attendees` | Event helper / coordinator / secretary of that branch, admin |
| POST | `/api/events/:id/checkin` `{ code }` | Same; result is `ok`, `already`, `removed`, `inactive` or `unknown` |
| DELETE | `/api/events/:id/checkin/:userId` | Same (undo a mistaken scan) |

## Events and the gate scanner

- Times are typed and shown in **Sri Lanka time** (UTC+05:30), wherever the person is.
- An event is for one branch or **all branches**. Coordinators manage their own branch's events;
  joint events need the central Secretary or the main admin.
- **Gate scanning** (`/events/:id/scan`): the phone camera reads the QR code on a member's card
  (which holds only her member number) and shows her photo, branch and batch in green, or a
  warning in amber/red if she is already in, removed, or unknown. Member numbers can be typed too.
  Scanning opens 12 hours before the start and closes 24 hours after the end.
- Phones only allow the camera on **https://** sites, so on a phone the scanner works once the
  site is live (step 6). On your PC, `http://localhost` is allowed.
- `npm run seed:demo` adds an event helper (`helper@demo.lk`), member numbers for the demo
  members, and three demo events, one of them happening now for testing the scanner.

## How registration works

1. She fills in the form at `/register`, crops her photo in the browser (5:6), and sets her password.
2. The server shrinks the photo to 400 × 480 WebP with `sharp` and stores it on Cloudinary as a
   **private** ("authenticated") image. Only signed links from the server can open it.
3. Her account is `pending`. The branch coordinator (or Secretary / admin) sees it under
   **Committee → New registrations**, as the card she will get, and approves or rejects it.
4. Approval gives her a member number like `OGA-KDY-2004-0012`. Rejection deletes her photo, and
   she may register again with the same email.
5. She logs in and opens **My card**: the QR code holds only her member number.

All image code is in `server/src/services/photos.js`, so changing image service later only
touches that file. Branch houses can be listed per branch (`houses` on the Branch record in
Atlas); until then the form shows a text box.

## Deploying on Render (step 6)

- Build command: `npm install --include=dev && npm run build`
- Start command: `npm start`
- Environment: the same values as `.env`, plus `NODE_ENV=production`
