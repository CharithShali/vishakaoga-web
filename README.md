# vishakaoga-web

Website for the **Vishaka Vidyalaya Old Girls' Association (OGA)**, with three branches:
Bandarawela (BDW), Colombo (COL) and Kandy (KDY).

**Stack:** React (Vite) · Express · MongoDB Atlas · Cloudinary (photos, from step 2).
One Node app serves both the API and the website, so it runs as a single Render service.

## Build progress

- [x] **Step 1:** project setup, branches, login, committee roles
- [x] **Step 2:** registration (incl. current profession) with photo crop, committee approval, QR membership card
- [x] **Step 3:** events, "I'm attending", QR scanning at the gate, attendance lists
- [x] **Step 4:** fund records per branch, funds with goals, membership fees on the card
- [x] **Step 5:** news posts, history page, batch wall, Excel/PDF downloads
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
| `npm run seed:demo` | Adds test members and resets their password to `DEMO_PASSWORD` (refused when `NODE_ENV=production`) |
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
  src/models/           MongoDB models: Branch, User, Counter, Event, Fund, Post, History…
  src/services/         Photo resize + Cloudinary
  src/routes/           API: auth, branches, users, events, funds, posts, history, batches, exports…
  src/middleware/       Login cookie, role checks, input validation
  src/utils/            Permission rules, Excel/PDF writers (+ tests)
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
| GET | `/api/users/:id/details` (details, payment history, events attended, fee reminders) | Secretary / treasurer (own branch only) / admin |
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
| GET | `/api/posts?branch=&category=&skip=&published=1` · `/api/posts/:id` | Anyone (members-only posts need a login; drafts only for their editors) |
| POST · PUT · DELETE | `/api/posts` · `/api/posts/:id` | Coordinator (own branch) / secretary / admin; all-branch posts need a central role |
| POST | `/api/images?shape=wide\|portrait` (multipart `image`) → `{ id, url }` | Coordinator / secretary / admin |
| GET · PUT | `/api/history` | Anyone reads; central Secretary / admin saves |
| GET | `/api/batches` · `/api/batches/:branch/:year` | Anyone (counts) · logged-in members (names) |
| GET | `/api/exports/members?branch=&batch=` · `/events/:id` · `/funds?branch=&year=` · `/fees?year=&branch=&show=` with `format=xlsx\|pdf` | See the downloads table |

## Fund records

- **Members** (logged in) see the totals, the funds and every record. Who paid and receipt numbers
  are shown to the committee only.
- **Treasurers** record money in and out: a branch treasurer for her branch, a central treasurer
  (or the main admin) for central money and every branch. Only the central treasurer or the main
  admin can add funds and set goals.
- **Records are never deleted.** A wrong entry is *voided* with a reason: it stays visible,
  crossed out, and stops counting in the totals.
- Money is stored in whole cents and dates as plain `YYYY-MM-DD` text, so totals never round
  wrongly and dates never shift with time zones.
- A **Membership fee** linked to a member and a year shows on her **My card** page.
- `npm run seed` creates the General, Scholarship and School project funds;
  `npm run seed:demo` adds a Kandy treasurer (`treasurer@demo.lk`) and sample records.

| Method | Path | Who |
| --- | --- | --- |
| GET | `/api/funds` · `/api/funds/summary?branch=&year=` · `/api/funds/transactions?branch=&year=&fund=&type=&skip=` | Logged-in members (`branch`: empty, `central` or a branch id) |
| POST · PUT | `/api/funds/transactions` · `/api/funds/transactions/:id` | Treasurer of that branch / central treasurer / admin |
| POST | `/api/funds/transactions/:id/void` `{ reason }` | Same |
| GET | `/api/funds/member-search?q=` | Treasurers |
| POST · PUT | `/api/funds` · `/api/funds/:id` | Central treasurer / admin |

## Membership fees and reminders

- **Committee → Membership fees** (admin, Secretary, Treasurer; branch roles see their branch):
  for a year, every active member as **Paid** (amount, date) or **Not paid**, with counts, search,
  and **Record fee** for treasurers (opens the money form already filled in).
- **Reminders:** *Remind all unpaid* or *Remind selected* puts a notification under the **bell**
  in the member's menu (members who have paid are always skipped). Each unpaid member also has a
  **WhatsApp** button that opens WhatsApp with the reminder typed in (Sri Lankan numbers like
  `0771234567` become `94771234567`). Email/SMS reminders would need a sending service and can be
  added later.
- **Member page** (`/committee/members/:id`): click a name in the Committee list or on the
  Membership fees page. Shows her card, contact, school and work details, payment history (voided
  entries crossed out), events she attended and reminders sent. The main admin removes, restores
  or permanently deletes a membership from here (red button, a reason is required).

| Method | Path | Who |
| --- | --- | --- |
| GET | `/api/fees/status?year=&branch=&q=&show=all\|paid\|unpaid` | Secretary / treasurer (own branch) / admin |
| POST | `/api/fees/remind` `{ year, memberIds? \| allUnpaid, branch? }` | Same |
| GET | `/api/notifications` · `/api/notifications/unread-count` · POST `/api/notifications/read-all` | Logged-in members (their own) |

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

## News, history and the batch wall (step 5)

- **News** (`/news`): branch coordinators post for their branch; the central Secretary and the main
  admin also post for all branches. A post has a kind (Notice, Reunion…), a short summary, an
  optional 16:9 picture and the text (a blank line starts a new paragraph; links become clickable).
  **Save as draft** keeps it for the committee only; **Members only** hides it from visitors.
  The three newest posts show on the home page.
- **History** (`/history`): the school story, motto, timeline, the three branches (since, address,
  principal, photo), this term's committee, past presidents and "members who made us proud".
  The central Secretary or the main admin edits it all at `/history/edit` and saves once.
- **Batch wall** (`/batches`): for each branch, every year from its "since" year to now, filled in
  when someone from that batch has joined and dashed when nobody has yet. Anyone sees the numbers;
  only logged-in members see the names (plus class, house, city, and work if she chose to share it).
- **Pictures** for news, branches and honours are public on Cloudinary (`vishakaoga/public`), cut to
  shape in the browser and shrunk with `sharp`. Member card photos stay private as before.
- `npm run seed:demo` adds four demo posts (one draft, one members-only) and, only if the real one
  hasn't been written yet, a history page clearly marked "sample".

## Excel and PDF downloads

Each list has **Excel** and **PDF** buttons. The files are made on the server (Excel by our own
small writer in `server/src/utils/xlsx.js`, PDF with `pdf-lib`), so they work the same on phones.

| Where | What you get | Who |
| --- | --- | --- |
| Committee → members | Member list grouped by branch and batch, or one batch: member no., names, class, house, roles at school, phone, email, city, profession | Secretary / coordinator (own branch) / admin |
| Event page → Who's coming | Attendance: said attending, time scanned in, scanned by | Event helper / coordinator / secretary of that branch, admin |
| Funds | Fund statement for the chosen branch and year, with totals (voided records left out) | Committee |
| Membership fees | Paid / not paid for the year, amount, date, reminders sent | Secretary / treasurer (own branch) / admin |

Excel files keep the header row fixed while scrolling and printing, and print landscape on one page
wide. The built-in PDF fonts can't show Sinhala or Tamil letters (they print as "?"); Excel shows
everything.

## Deploying on Vercel

`vercel.json` and `api/index.js` are ready: Vercel serves the built pages from `client/dist` and runs
the whole Express API as one function (`api/index.js`). No other changes are needed.

1. Vercel → **Add New → Project** → import `CharithShali/vishakaoga-web`. Leave the root directory as
   it is (the repository root); `vercel.json` sets the build.
2. Under **Environment Variables** add `MONGODB_URI`, `JWT_SECRET` (a new long random one),
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`. Don't add `NODE_ENV`
   (it would skip the tools needed to build the pages).
3. MongoDB Atlas → **Network Access** → allow `0.0.0.0/0`: Vercel doesn't have fixed addresses.
4. Deploy. Then Vercel → project **Settings → Functions → Function Region**: choose the region
   nearest your Atlas cluster (e.g. Mumbai `bom1` for AWS ap-south-1, Singapore `sin1`), and redeploy.

Run `npm run seed` / `seed:demo` from your own computer; they talk to the same Atlas database.

## Deploying on Render (alternative)

- Build command: `npm install --include=dev && npm run build`
- Start command: `npm start`
- Environment: the same values as `.env`, plus `NODE_ENV=production`
