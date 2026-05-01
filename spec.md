
***

# School Event Passport — App Proposal

this is the government project. the ui and the ux should look clean, reliable and good looking. also it should has all basic security implemetation to prevent the basic attack/hack to prevent data leak (all the data in the app is already using fake data). also make sure this app enable and esaily handle at least 200 user concurrent connection and usage. never overload the server.

> This document is the complete specification for building the School Event Passport app from scratch. The developer must implement the entire app based on this document alone. The provided `config.js` and EJS template files are included in the project folder and must be used as-is — do not modify them unless instructed.

***

## Event Overview

| Field | Value |
|-------|-------|
| **Event Name** | Other Languages Experience Day: Learn. Showcase. Connect. (學展同樂：其他語言體驗日) |
| **Date** | 11 July 2026 (Saturday) |
| **Time** | 10:00 a.m. to 12:00 noon |
| **Venue** | WP01, EDB Kowloon Tong Education Services Centre |
| **Participants** | ~200 players across multiple school groups |

***

## Purpose

Build a web-based digital passport system for a government language event. Players visit language and cultural booths, collect stamps, and redeem tiered gifts. The app runs on a single laptop at the venue and is exposed to players' phones via Cloudflare Tunnel over the venue WiFi.

***

## Architecture

```
Players' Phones (via venue WiFi + Cloudflare Tunnel)
        ↓
  *.trycloudflare.com  (public HTTPS URL, known only after tunnel starts)
        ↓
  cloudflared  (PM2 process)
        ↓
  Node.js / Express  (PM2 process, port 3000)
        ↓
  PostgreSQL 15  (Docker container, localhost:5432 only)
```

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Templating | EJS (server-rendered, use provided EJS files) |
| Database | PostgreSQL 15 via Docker (bound to localhost only) |
| Real-time updates | Socket.IO (WebSockets) — for reliable tunnel delivery |
| Process management | PM2 — manages both the Node app and cloudflared |
| Public access | Cloudflare Tunnel — bypasses venue WiFi client isolation |
| QR scanning | html5-qrcode (CDN) — on every code input across the entire app |
| Security | helmet, csrf-csrf, express-session, express-rate-limit |

***

## Provided Files — Use As-Is

The following files are already in the project folder. Build the rest of the app around them:

- **`config.js`** — single source of truth for all event rules and data. Never hardcode any value found here.
- **EJS template files** — provided views in the `views/` folder. Wire them up to the correct routes without modifying their structure.

***

## Privacy Requirements

| Rule | Implementation |
|------|----------------|
| No organisation names | Group QR codes only — no school names anywhere in the app |
| No real names | Player names are system-generated (Player#0001 etc.) |
| No group mapping in public views | Player portal never shows the group code |
| Code-based identification | 6-character unique IDs and QR codes throughout |

***

## Configuration Philosophy

`config.js` is the single source of truth for all event rules and initial data. Never hardcode any value that appears in `config.js`. Credentials and secrets (PINs, DB password, session secret) live in `.env` only. When `config.js` is updated before the event, a `pm2 restart` applies all changes — there is no hot-reload.

***

## config.js Reference

**BOOTHS (10 total — treat all 10 as active, set TOTAL_BOOTHS to 10):**

| Key | Name | Category | Stamp Value |
|-----|------|----------|-------------|
| french | French | A | 1 |
| german | German | A | 1 |
| japanese | Japanese | A | 1 |
| korean | Korean | A | 1 |
| spanish | Spanish | A | 1 |
| urdu | Urdu | A | 1 |
| arabic | Arabic | A | 1 |
| russian | Russian | A | 1 |
| postcard-writing | Postcard Writing | B | 1 |
| lounge-visit | Lounge Visit | C | 3 |

Lounge Visit is a full booth — same admin interface as others, contributes 3 stamp points.

**REDEMPTION_TIERS:**

| Tier | Required Stamps | Category Requirement | Gifts |
|------|----------------|----------------------|-------|
| Tier 1 | 5 | ≥ 1 category | Paper clips, Paper stand, Pen |
| Tier 2 | 8 | ≥ 2 categories | Leaf corner, Bookmark, Keyboard clicker key chain |
| Tier 3 | 12 | All 3 categories | Recorder toy |

**GROUPS (sample — operator replaces before event):** BKRF75GY (40), UHM6KVWD (30), M5KTAHB7 (10), PMMP7E42 (40)

**RATE_LIMITS:** 120/min general, 20/min registration/stamp/redemption, 10 per 15min admin login, 5 per 15min developer login

**Other:** MAX_ROUNDS 5, TOTAL_BOOTHS 10, SESSION_TIMEOUT_MS 8 hours, DB_POOL_MAX 20, LOW_STOCK_THRESHOLD 10

***

## Cloudflare Tunnel

`cloudflared` runs as a second PM2 process pointing to `http://localhost:3000`. On startup it outputs a public `*.trycloudflare.com` URL. All QR code URLs are built server-side using `req.protocol + req.get('host')` so they automatically embed the correct public domain.

Group QR codes must be generated on event morning — not pre-printed — so the correct live tunnel URL is always embedded.

**Event morning startup sequence:**
1. `npm run db:reset`
2. `npm run db:schema`
3. `npm start` — starts both app and tunnel via PM2
4. `pm2 logs cloudflare-tunnel --lines 20` — grab the public URL
5. Open Developer Dashboard through the public URL
6. Developer Dashboard → Initialise from Config
7. Groups tab → verify QR codes show correct tunnel URL, display or print
8. Share `https://[tunnel-url]/register` with all players (on screen or printed sheet)

***

## QR Code Input — Universal Rule

Every input field that accepts a code anywhere in the app must include a camera button activating `html5-qrcode` from CDN. Scanning fills the input and dismisses the scanner. Manual typing always available as fallback. No exceptions.

***

## Player Registration Workflow

### Step 1 — Group Check-in (Admin, before players arrive)
Staff go to `/admin/group-checkin`, scan or type the group QR code, confirm. System marks group `checked_in = true`.

### Step 2 — Player Opens Registration Page
Player navigates to `/register` — one shared URL for all players, shown on a screen or printed general QR code at the event entrance.

### Step 3 — Player Scans Their Group QR Code
On the `/register` page, the player uses the on-page camera scanner to scan the same QR code the group used for check-in. The QR code contains only the raw group code string (e.g., `BKRF75GY`). Manual typing also accepted.

### Step 4 — Player Clicks Continue

| State | Button | Message |
|-------|--------|---------|
| Group not found | Disabled | "Invalid group code" |
| Not checked in | Disabled | "Registration not open yet" |
| Quota full | Disabled | "This group is full" |
| Valid and open | Enabled | "Continue" |

### Step 5 — Account Created, Redirected to Passport
System atomically: assigns next number from `player_number_seq`, creates account as `Player#0001`–`Player#9999`, generates 6-char unique ID (e.g., `AB12C3`), reduces group quota, redirects to `/player/:uniqueId`.

***

## Player Portal (`/player/:uniqueId`)

Shows: player name, unique ID, QR code back to portal, passport grid (10 booths, ✓/○, current round only), current round, stamp total (`SUM(stamp_value)`), redemption eligibility. Updates live via Socket.IO. Group code never shown. UI follows provided `player-portal.ejs`.

***

## Admin Section

PIN-only login (`ADMIN_PIN` from `.env`). No username. Four pages exactly:

### 1. Group Check-in — `/admin/group-checkin`
Scan or type group code. Shows quota, registered, remaining. Confirm to check in.

### 2. Player Register and Lookup — `/admin/counter`
**Register:** manually create a player for a group by scanning/typing group code.
**Lookup:** search by unique ID, player name, or group code. Result shows player name, ID, and QR code for portal recovery.

### 3. Stamp Issue — `/admin/booth`
Select booth from dropdown (all 10 from `config.BOOTHS`). Scan or type player unique ID. ID is populated in the field; admin must click **Issue Stamp** to confirm. Issue stamp → update grid on admin screen + Socket.IO push to player portal. Error shown if already stamped this booth this round. Revoke button for mistakes.

### 4. Redemption Counter — `/admin/redeem`
Scan or type player unique ID. Shows stamp total, categories, eligible tiers. Staff selects gift, confirms. Atomic claim — inventory decremented in one transaction. Catches out-of-stock between display and confirm. Each tier once per round per player. **Advance Round** button only enabled after player collects all 12 stamp points.

***

### Developer Section — `/developer/dashboard`
PIN-only (`DEVELOPER_PIN`). Advanced real-time console for total system management.
- **Tabs:** Players, Stamps, Redemptions, Groups, Gifts, System Links, Config Editor, Init, Export.
- **Smart CRUD:** Full management for all tables. Modals feature **searchable dropdowns** (Tom Select) for easy navigation of 200+ users.
- **Auto-Generation:** Leave ID fields (UID, Group Code, Seq) blank to have the system auto-generate secure values.
- **Group Check-in:** Manage group check-in status directly from the dashboard.
- **System Links:** Hub with live QR codes and copy-buttons for all vital system pages.
- **Config Editor:** Browser-based `config.js` editor with integrated server restart.
- **Live Sync:** Top-row stats and all data tables auto-refresh every 5 seconds.
- **Export:** Select any database table and export as CSV or JSON.

***

## Real-Time Updates (Socket.IO)

Bi-directional communication via WebSockets. Mandatory for bypassing Cloudflare Tunnel buffering issues. 
- **Room Management**: Players join a room based on their `uniqueId` (uppercase).
- **Broadcast**: Server emits to specific rooms for targeted updates.
- **Heartbeat**: Handled natively by Socket.IO.

Events: `stamp:issued`, `stamp:revoked`, `student:update`

***

## Database Schema

Fixed structure. All DDL uses `CREATE TABLE IF NOT EXISTS`. Full reset: `docker-compose down -v && docker-compose up -d`.

**Tables:** `groups`, `players`, `stamps`, `redemptions`, `gift_inventory`, `security_logs`

| Decision | Detail |
|----------|--------|
| `player_number_seq` | PostgreSQL sequence — atomic, max 9999 |
| `players.player_number` | From sequence, display as `Player#XXXX` |
| `players.unique_id` | 6-char random uppercase alphanumeric |
| `stamps.stamp_value` | Copied from config at insert — totals use `SUM(stamp_value)` |
| `stamps.round_number` | Copied from player's current_round — stamps never deleted |
| `stamps` UNIQUE | `(player_id, booth_name, round_number)` |
| `redemptions.round_number` | Once per tier per round |
| `redemptions` UNIQUE | `(player_id, tier_claimed, round_number)` |
| Round reset | Increments `current_round` only — no data deleted |

**Stored procedures:** `get_player_round_summary`, `claim_redemption_atomic`, `reset_player_round`

***

## Security

| Measure | Detail |
|---------|--------|
| helmet | HTTP headers + CSP, whitelist `ws:` and `wss:` for Socket.IO |
| csrf-csrf | Double-submit tokens on all POST routes |
| PIN rate limiting | Admin 10/15min, Developer 5/15min |
| Startup validation | Refuse start if SESSION_SECRET < 32 chars |
| DB binding | `127.0.0.1:5432` only |
| Session | SameSite=Strict, httpOnly, configurable timeout |

***

## Docker (`docker-compose.yml`)

`postgres:15-alpine`, `DB_PASSWORD` from `.env`, port `127.0.0.1:5432`, named volume, `restart: unless-stopped`, `pg_isready` health check.

***

## PM2 (`ecosystem.config.js`)

| Process | Runs |
|---------|------|
| `event-passport` | `server.js` (fork mode mandatory for Socket.IO) |
| `cloudflare-tunnel` | `cloudflared tunnel --url http://localhost:3000` |

Both auto-restart. Logs to `./logs/`. Run `pm2 startup && pm2 save`.

***

## Environment Variables (`.env`)

```
PORT=3000
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=school_event
DB_USER=event_user
DB_PASSWORD=strong_password_here
ADMIN_PIN=your_admin_pin
DEVELOPER_PIN=your_developer_pin
SESSION_SECRET=64_char_hex_from_crypto_randomBytes
```

***

## Dependencies (`package.json`)

```json
{
  "dependencies": {
    "cookie-parser":      "^1.4.6",
    "csrf-csrf":          "^3.0.3",
    "dotenv":             "^16.3.1",
    "ejs":                "^3.1.9",
    "express":            "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "express-session":    "^1.17.3",
    "helmet":             "^7.1.0",
    "pg":                 "^8.11.3",
    "qrcode":             "^1.5.3",
    "socket.io":          "^4.7.2",
    "uuid":               "^9.0.1"
  }
}
```

Socket.IO mandatory for real-time delivery. PM2 global. html5-qrcode from CDN only.

***

## API Endpoints

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Redirect to `/register` |
| GET | `/health` | DB status + Socket connection count |
| GET | `/register` | Registration page (shared, all players) |
| POST | `/api/players/register` | Create player |
| GET | `/player/:uniqueId` | Player portal |
| GET | `/api/player/:uniqueId` | Player data + round summary |
| GET | `/api/groups/validate/:qrCode` | Validate group (live button state) |

### Admin (PIN + CSRF)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/admin/login` | PIN login |
| POST | `/admin/logout` | Logout |
| GET | `/admin/group-checkin` | Check-in page |
| POST | `/api/admin/groups/checkin` | Mark checked in |
| GET | `/api/admin/groups/lookup/:qrCode` | Look up group |
| GET | `/admin/counter` | Register + lookup page |
| POST | `/api/admin/players/create` | Manual player create |
| GET | `/api/admin/players/search` | Search players |
| GET | `/admin/booth` | Stamp issue page |
| POST | `/api/admin/stamps/issue` | Issue stamp + Socket.IO |
| POST | `/api/admin/stamps/revoke` | Revoke stamp + Socket.IO |
| GET | `/admin/redeem` | Redemption page |
| POST | `/api/admin/redemption/lookup` | Get eligibility |
| POST | `/api/admin/redemption/claim` | Atomic gift claim |
| POST | `/api/admin/rounds/reset` | Advance round |

### Developer (PIN + CSRF)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/developer/login` | PIN login |
| GET | `/developer/dashboard` | Dashboard |
| POST | `/api/developer/init-all` | Seed from config (idempotent) |
| GET | `/api/developer/export` | CSV or JSON export |
| GET/POST/PUT/DELETE | `/api/developer/players` | CRUD |
| GET/POST/PUT/DELETE | `/api/developer/stamps` | CRUD |
| GET/POST/PUT/DELETE | `/api/developer/redemptions` | CRUD |
| GET/POST/PUT/DELETE | `/api/developer/groups` | CRUD |
| GET/POST/PUT | `/api/developer/gifts` | Inventory |
| GET | `/api/developer/stats` | Live stats |

***

## Views (EJS — use provided files, wire to routes)

| File | Route |
|------|-------|
| `register.ejs` | `GET /register` |
| `player-portal.ejs` | `GET /player/:uniqueId` |
| `admin-login.ejs` | `GET /admin/login` |
| `admin-group-checkin.ejs` | `GET /admin/group-checkin` |
| `admin-counter.ejs` | `GET /admin/counter` |
| `admin-booth.ejs` | `GET /admin/booth` |
| `admin-redeem.ejs` | `GET /admin/redeem` |
| `developer-login.ejs` | `GET /developer/login` |
| `developer-dashboard.ejs` | `GET /developer/dashboard` |
| `error.ejs` | All errors |

***

## Project File Structure

```
school-event-passport/
├── server.js
├── db.js
├── socket.js                      ← Socket.IO logic
├── config.js                     ← provided
├── ecosystem.config.js
├── docker-compose.yml
├── package.json
├── .env
├── .gitignore
├── helpers/
│   └── config-helpers.js
├── middleware/
│   ├── requireAdmin.js
│   └── requireDeveloper.js
├── routes/
│   ├── public.js
│   ├── admin.js
│   ├── api-admin.js
│   ├── api-public.js
│   ├── developer.js
│   └── api-developer.js
├── views/                        ← provided EJS files
├── public/
│   ├── js/
│   │   ├── common.js
│   │   ├── player-portal.js
│   │   ├── admin-counter.js
│   │   ├── admin-booth.js
│   │   ├── admin-redeem.js
│   │   └── admin-overview.js
│   └── css/
│       └── style.css
├── sql/
│   ├── init.sql
│   └── seed.sql
└── logs/
```

***

## Business Rules

| Rule | Detail |
|------|--------|
| Player naming | Player#0001–Player#9999 via PostgreSQL sequence — atomic |
| Unique ID | 6-char random uppercase alphanumeric |
| Stamp counting | `SUM(stamp_value)` — Lounge Visit = 3 points |
| Stamp history | Never deleted — `round_number` preserves all rounds |
| Round reset | Increments `current_round` only — no data deleted |
| Redemption | Once per tier per round |
| Quota | Real-time `COUNT(*)` with `FOR UPDATE` lock |
| Gift claim | Atomic stored procedure |
| QR code URL | Server-side `req.protocol + req.get('host')` |
| Group code in QR | Raw string only (e.g., `BKRF75GY`) — not a URL |
| Registration entry | `/register` — one shared URL for all players |

***

ui and ux:
the user pages should be priporitize for the smartphone usage. admin for ipad, then smartphone. deveoper pages for laptop. 

## Acceptance Criteria

- [ ] Player opens `/register`, scans group QR, clicks Continue, account created, redirected to portal
- [ ] Continue disabled with correct message if group not checked in or quota full
- [ ] Player name auto-assigned Player#XXXX via sequence — no collisions
- [ ] Quota enforced atomically
- [ ] Every code input has a camera QR scanner button
- [ ] Portal updates live via Socket.IO — no refresh needed
- [ ] Socket.IO supports multiple devices per player
- [ ] Admin has exactly four pages: group check-in, counter, booth, redemption
- [ ] All 10 booths listed including Lounge Visit — `SUM(stamp_value)` for totals
- [ ] Stamps never deleted — `round_number` tracks all rounds
- [ ] Round reset: increment only, no data loss
- [ ] Gift claim atomic and inventory-safe — once per tier per round
- [ ] Counter lookup shows QR code for portal recovery
- [ ] Developer: CRUD, init-all (idempotent), export
- [ ] Cloudflare Tunnel as PM2 process
- [ ] QR codes use `req.get('host')` — always correct URL
- [ ] `/register` is one shared page — not per-group URL
- [ ] Group QR contains raw code string only
- [ ] PIN-only login with rate limiting
- [ ] helmet, SameSite=Strict, CSRF on all POST routes
- [ ] PostgreSQL on localhost only
- [ ] All DDL: `CREATE TABLE IF NOT EXISTS`
- [ ] `GET /health` returns DB status and Socket count
- [ ] Refuses to start in production if SESSION_SECRET < 32 chars
