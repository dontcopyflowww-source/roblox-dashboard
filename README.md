# Roblox Live Stats Dashboard

Tracks player currency, level, and inventory from your Roblox game and shows
them live on a web dashboard — no manual refresh.

```
Roblox Game --HTTP--> Node/Express server --SQLite--> live via Socket.io --> Dashboard
```

## What's in here

- `server/` — Node.js backend. Owns a local SQLite database (`game.db`,
  created automatically on first run). Exposes an API for your Roblox game
  to post updates to, and pushes those updates to the dashboard live over
  a websocket.
- `server/public/index.html` — the dashboard itself. Plain HTML/CSS/JS,
  served as a static file by the backend, no build step.
- `roblox/StatsReporter.lua` — drop-in server script for your Roblox game
  that reports stats to the backend.

## 1. Run the backend

```bash
cd server
npm install
DASHBOARD_API_KEY=pick-a-long-random-string npm start
```

Open `http://localhost:3000` — you'll see the dashboard in demo mode
(simulated data) until real updates arrive, because your browser can reach
the server but no game is reporting yet.

## 2. Wire up Roblox

1. In Roblox Studio: **Game Settings → Security → Allow HTTP Requests** (turn on).
2. Add `roblox/StatsReporter.lua` as a **Script** inside `ServerScriptService`.
3. Edit the two constants at the top:
   - `API_URL` — your backend's public URL (see step 3, it can't be `localhost`).
   - `API_KEY` — same string you set as `DASHBOARD_API_KEY`.
4. Adjust `getPlayerSnapshot()` to match how your game actually stores
   currency/level/inventory (the script assumes a `leaderstats` folder with
   `Currency`/`Level` IntValues, and an `Inventory` folder of items — very
   common setups, but yours may differ).

## 3. Put the backend somewhere Roblox can reach

Roblox's servers run in the cloud, so they can't call `localhost` on your
machine. Deploy the `server/` folder to a host with HTTPS, e.g.:

- **Render** or **Railway** (both have simple free tiers, push-to-deploy from a repo)
- **Fly.io**
- Any VPS behind a domain with HTTPS

Set the `DASHBOARD_API_KEY` environment variable on whichever host you pick,
matching the value in the Luau script. Then update `API_URL` in the script
to the deployed URL and publish your game.

## 4. Open the dashboard

Visit your deployed URL (or `localhost:3000` while testing) in a browser.
Cards appear automatically as players join and update live as their stats
change — no page refresh.

## Notes / next steps

- Data persists in `server/game.db` (SQLite) between restarts.
- The `/api/event` endpoint is there if you want a live feed of events later
  (purchases, deaths, etc.) — currently logged but not yet shown on the
  dashboard; easy to add a feed panel for it if useful.
- For production, put the backend behind a reverse proxy (e.g. Caddy or
  nginx) for HTTPS and consider rate-limiting the API routes.
