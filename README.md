# Raw XO

> **Five seconds. Four options. One instinct.**

A clip starts playing. The clock is bleeding out. You either know the song or
you don't — and Raw XO is built around that one honest moment.

Raw XO is a cinematic music game and culture room for people who remember songs
by *feeling* — the cover art, the era, the late-night context — not by reading a
tracklist. It's a charcoal-and-amber, Apple-cinematic web app: a fast guessing
game up front, a place to argue about what lyrics actually mean out back, and a
leaderboard to keep you honest about how good your ear really is.

No "sign up to continue" wall. Guest mode is instant — you're one tap from a
round. Sign in only when you want your streaks, ratings, and history to follow
you around.

## What's inside

- **🎧 The 5-second game.** A clip plays, four track names appear, and you pick
  before it disappears. Faster correct answers score more; streaks stack a
  multiplier. Five clips make a session, then you get a recap with a (slightly
  judgmental) read on your taste.
- **🎚️ Difficulty that actually means something.** Easy gives you a roomy 10s and
  serves the hits; medium tightens to 7s; hard drops you to 5s and digs up the
  old OG deep cuts nobody streams anymore. Filter by genre, language (English,
  Hindi, Punjabi, Korean, Spanish), or pin a single artist's catalog.
- **🏆 Leaderboards & profiles.** Daily and all-time boards, sliceable by artist
  and genre. Earn XP, climb levels, collect badges. Guests rank too — under a
  stable, randomly-generated handle like *Midnight Vinyl*.
- **📝 Culture archive.** Lyric meanings, reactions, reviews, and lyric-guessing
  for trending tracks — the part where people argue about what a song is really
  about.
- **🎫 Tour calendar.** Live music listings for Indian cities, with quick links
  out to tickets.

## How a round feels

1. Pick a vibe — genre, language, an artist, a difficulty — or just hit play and
   take what the shuffle gives you.
2. A clip fires. The bar drains. Four options stare back at you.
3. Tap your gut. Instant reveal: album art, the answer, and your points.
4. Rate the track, watch your streak, and run it back. Five rounds, one
   scorecard.

## Built with

- **Frontend:** Vite + React + TypeScript, Tailwind, Framer Motion for the
  motion design, a hand-written Three.js shader (`LaserFlow`) for the backdrop,
  Zustand for state, React Router.
- **Backend:** Express + MongoDB (Mongoose), with a `dev-data.json` fallback so
  it runs even without a database.
- **Music data:** iTunes Search API for fast preview clips, Spotify (optional)
  for real stream-popularity and richer catalog search.
- **Auth:** Clerk, with a first-class guest mode for everyone else.

## Project structure

- [client](C:/Raw_Xo/client) - Vite + React frontend
- [server](C:/Raw_Xo/server) - Express + MongoDB backend

## Local development

Install both apps:

```bash
npm run install:all
```

Run the backend:

```bash
npm run dev:server
```

Run the frontend:

```bash
npm run dev:client
```

Frontend:

- [http://127.0.0.1:5173](http://127.0.0.1:5173)

Backend:

- [http://127.0.0.1:5000/health](http://127.0.0.1:5000/health)

## Environment variables

### Frontend

Create `client/.env` from [client/.env.example](C:/Raw_Xo/client/.env.example).

Required for production:

- `VITE_API_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_APPLE_MUSIC_COUNTRY`

### Backend

Create `server/.env` from [server/.env.example](C:/Raw_Xo/server/.env.example).

Important values:

- `MONGODB_URI`
- `CLERK_SECRET_KEY`
- `JWT_SECRET`
- `GAME_SECRET`
- `CLIENT_ORIGIN`
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` if you want Spotify-backed public catalog search for game and artist search

Spotify is used only for public catalog search through Client Credentials. Artist search can use Spotify when credentials are present. Game track search stays on iTunes previews by default for speed; set `GAME_SPOTIFY_TRACK_SEARCH=true` only if you want to test Spotify preview URLs. Do not put `SPOTIFY_CLIENT_SECRET` in frontend code. If you later add user-specific Spotify features, use Authorization Code with PKCE or backend Authorization Code flow with the minimum scopes needed.

`CLIENT_ORIGIN` supports comma-separated values, for example:

```env
CLIENT_ORIGIN=http://localhost:5173,https://your-frontend-domain.onrender.com
```

For production security, also set:

- `ADMIN_USER_IDS` - comma-separated Mongo user ids allowed to create/update tour records
- `REQUIRE_AUTH_FOR_CULTURE_WRITES=true` if meaning votes, reactions, and reviews should require sign-in

Production deploys intentionally fail if `MONGODB_URI`, Clerk keys, `JWT_SECRET`, `GAME_SECRET`, or `CLIENT_ORIGIN` are missing or still using placeholder values. Clerk test keys (`pk_test_` / `sk_test_`) are blocked in production.

If MongoDB is unavailable in development, the backend falls back to `server/dev-data.json`.

## Deploy to Vercel

This repo is Vercel-ready as a single project:

- Frontend: Vite build from [client](C:/Raw_Xo/client)
- Backend: Express API through [api/index.ts](C:/Raw_Xo/api/index.ts)
- API base path: `/api/v1`

Vercel should use the root project directory with these settings from [vercel.json](C:/Raw_Xo/vercel.json):

```text
Install command: npm ci --include=dev
Build command: npm run build:vercel
Output directory: client/dist
```

Required Vercel environment variables:

```env
NODE_ENV=production
MONGODB_URI=your_mongodb_uri
CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_publishable_key
CLERK_SECRET_KEY=sk_live_your_clerk_secret_key
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_publishable_key
JWT_SECRET=your_32_plus_character_jwt_secret
GAME_SECRET=your_32_plus_character_game_secret
GAME_ARTIST_QUERY=the weeknd, kanye west, travis scott, drake
GAME_ITUNES_COUNTRY=us
GAME_ITUNES_LIMIT=80
GAME_ITUNES_TIMEOUT_MS=4500
GAME_MAX_QUERY_TERMS=6
GAME_TRACK_CACHE_MS=600000
GAME_SPOTIFY_MARKET=US
GAME_SPOTIFY_TRACK_SEARCH=false
VITE_API_URL=/api/v1
VITE_APPLE_MUSIC_COUNTRY=IN
ADMIN_USER_IDS=your_mongo_user_id
REQUIRE_AUTH_FOR_CULTURE_WRITES=true
```

Optional Spotify artist search:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

### Clerk on Vercel

If Vercel shows Clerk in "Development mode", the deployment is still using a `pk_test_` key. Use the live Clerk application keys in Vercel:

- `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...`
- `CLERK_PUBLISHABLE_KEY=pk_live_...`
- `CLERK_SECRET_KEY=sk_live_...`

Do not leave these variables as blank strings in Vercel. A blank `VITE_CLERK_PUBLISHABLE_KEY` means the browser cannot boot Clerk, and a blank `CLERK_PUBLISHABLE_KEY` means the API cannot verify Clerk sessions.

In the Clerk dashboard, add your Vercel production domain to the allowed origins and redirect URLs. Also check the Google social connection settings: first-time Google users need sign-up/account creation enabled, otherwise Clerk can return "The External Account was not found" when they try Google on the sign-in screen.

If a Vercel URL returns `401 Unauthorized` before the app loads, check Vercel Project Settings -> Deployment Protection. That is Vercel blocking the deployment before React or Clerk runs.

`CLIENT_ORIGIN` is optional on Vercel because the backend can use Vercel's automatic `VERCEL_URL`. Set it manually only when you need to allow extra origins, for example a custom domain:

```env
CLIENT_ORIGIN=https://your-domain.com,https://your-project.vercel.app
```

Before pushing:

```bash
npm run build:vercel
git status --short
```

Then push to GitHub and import the repo into Vercel. Use root directory `/`, not `client` or `server`.

## Deploy from GitHub to Render

The cleanest self-serve path for this repo is:

1. Frontend on Render Static Site
2. Backend on Render Web Service
3. Repo hosted on GitHub

This repo already includes [render.yaml](C:/Raw_Xo/render.yaml) to help with that.

### 1. Push to GitHub

From the repo root:

```bash
git add .
git commit -m "polish login and prep vercel deploy"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/raw-xo.git
git push -u origin main
```

### 2. Deploy the backend on Render

In Render:

1. New Web Service
2. Connect your GitHub repo
3. Use root directory: `server`
4. Build command:

```bash
npm install && npm run build
```

5. Start command:

```bash
npm start
```

6. Add environment variables:

```env
PORT=5000
NODE_ENV=production
MONGODB_URI=your_mongodb_uri
CLERK_SECRET_KEY=your_clerk_secret_key
JWT_SECRET=your_jwt_secret
GAME_SECRET=your_game_secret
GAME_ARTIST_QUERY=the weeknd, kanye west, travis scott, drake
GAME_ITUNES_COUNTRY=us
GAME_ITUNES_LIMIT=80
GAME_TRACK_CACHE_MS=600000
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
GAME_SPOTIFY_MARKET=US
GAME_SPOTIFY_TRACK_SEARCH=false
CLIENT_ORIGIN=https://your-frontend-domain.onrender.com
ADMIN_USER_IDS=your_mongo_user_id
REQUIRE_AUTH_FOR_CULTURE_WRITES=true
```

After deploy, copy the backend URL. It will look like:

```text
https://raw-xo-api.onrender.com
```

Check health:

- `https://your-backend-domain/health`

### 3. Deploy the frontend on Render

In Render:

1. New Static Site
2. Connect the same GitHub repo
3. Use root directory: `client`
4. Build command:

```bash
npm install && npm run build
```

5. Publish directory:

```bash
dist
```

6. Add environment variables:

```env
VITE_API_URL=https://your-backend-domain.onrender.com/api/v1
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_APPLE_MUSIC_COUNTRY=IN
```

7. Make sure SPA routing rewrites to `index.html`

That rewrite is already included in [render.yaml](C:/Raw_Xo/render.yaml).

### 4. Update backend CORS origin

Once the frontend URL is known, make sure backend `CLIENT_ORIGIN` includes it:

```env
CLIENT_ORIGIN=http://localhost:5173,https://your-frontend-domain.onrender.com
```

Redeploy the backend after changing this.

## Manual deploy order

If you do it yourself without blueprints:

1. Deploy backend first
2. Copy backend URL
3. Set `VITE_API_URL` in frontend
4. Deploy frontend
5. Copy frontend URL
6. Add that frontend URL to backend `CLIENT_ORIGIN`
7. Redeploy backend

## Build checks

From repo root:

```bash
npm run build
```

## Game design

The 5-second guess game adapts to the difficulty you pick:

- **The clock scales with difficulty.** Easy gives you 10 seconds, medium 7,
  hard 5. The countdown and the server's speed-bonus window read the same
  numbers (`client/src/config/gameConfig.ts` and
  `server/src/config/gameConstants.ts`), so a longer clock always means a longer
  window to earn a speed bonus on — they can't drift apart.
- **Difficulty is popularity-aware.** Easy leans toward the hits, hard toward the
  deep cuts and older OG tracks, medium sits in the familiar-but-not-obvious
  middle. The signal is Spotify's real stream-based popularity when Spotify
  credentials are present; otherwise it falls back to an iTunes search-rank
  approximation, and finally to a release-year/duration heuristic. Set
  `GAME_SPOTIFY_TRACK_SEARCH=true` for the richest tiers.
- **The reveal is instant.** Answering no longer waits on the database. The
  server scores the guess in memory, flushes the result, and persists the score
  afterwards — so the correct/wrong reveal shows immediately even under DB
  latency. Writes still complete (the handler awaits them after responding, which
  keeps serverless functions alive), they just aren't on the critical path.
- **Songs keep mixing.** Recently-served correct answers are remembered per
  filter set (server-side) and the client also passes a recent-song exclusion
  list, so you don't get the same track twice in a session.

## Performance

Raw XO is tuned to stay light on the main thread and quick to first paint. The
guiding rule: nothing decorative should sit on the critical rendering path.

- **LCP-safe entrances.** Page and hero entrance animations use transform-only
  motion (a GPU-composited slide), never an `opacity: 0` fade. Chrome skips
  transparent elements when choosing the Largest Contentful Paint candidate, so
  fading the hero in from zero used to delay the headline by the whole
  animation. Reduced-motion users get an instant, static render.
- **Eager landing route.** The `/` route (the game) is statically imported, so
  the first screen ships in the initial bundle instead of waiting on a second
  lazy-chunk fetch. Every other route stays code-split.
- **Non-blocking fonts.** Google Fonts are fetched via `rel="preload"` and
  promoted to a stylesheet on load, with `display=swap` so text paints
  immediately in the fallback face and the web fonts swap in when ready.
- **Lazy, self-governing WebGL.** The Three.js `LaserFlow` backdrop (the single
  heaviest dependency) is lazy-loaded, mounted only after the page is idle, and
  skipped entirely for small screens and reduced-motion users. While running it
  adapts its pixel ratio to the live frame rate and pauses when off-screen or
  when the tab is hidden.
- **Code-split vendors.** React, Three.js, Framer Motion, and Clerk are split
  into separate chunks so a change in one doesn't bust the cache for the others.

Audit the bundle any time with `npm run build` from `client` — Vite prints the
gzipped size of every chunk.

## Notes

- Apple music data on the culture page is powered by the iTunes Search API.
- Lyrics meaning, reactions, reviews, and culture voting are persisted through the backend.
- The tours page uses live District public music listings, which is useful for MVP but not as stable as an official partner API.
