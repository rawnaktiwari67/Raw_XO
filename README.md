# Raw XO

> **Five seconds. Four options. One instinct.**

A clip starts playing. The clock is bleeding out. You either know the song or you don't — and Raw XO is built around that one honest moment.

Raw XO is a cinematic music game and culture room for people who remember songs by feeling — the cover art, the era, the late-night context — not by reading a tracklist. It's a charcoal-and-amber, Apple-cinematic web app: a fast guessing game up front, a scrollable culture feed to argue about what lyrics actually mean out back, and a leaderboard to keep you honest about how good your ear really is.

No "sign up to continue" wall. Guest mode is instant — you're one tap from a round. Sign in only when you want your streaks, ratings, and history to follow you around.

## What's inside

- 🎧 **The 5-second game.** A clip plays, four track names appear, and you pick before it disappears. Faster correct answers score more; streaks stack a multiplier. Five clips make a session, then you get a recap with a (slightly judgmental) read on your taste.
- 🎚️ **Difficulty that actually means something.** Easy gives you a roomy 10s and serves recent hits; medium tightens to 7s; hard drops you to 5s and digs up older, deeper cuts. Filter by genre, language (English, Hindi, Punjabi, Korean, Spanish), or pin a single artist's catalog.
- 🏆 **Leaderboards & profiles.** Daily and all-time boards, sliceable by artist and genre, each with your live rank. Earn XP, climb levels, collect a level badge. Guests rank too — under a stable, randomly-generated handle like "Midnight Vinyl."
- 📼 **Culture reels.** A scrollable, TikTok-style feed of trending tracks pulled from a curated Spotify pool — sort by Hottest or Newest, vote on what a lyric actually means, react, and leave a rated take.
- 🎫 **Tour calendar.** Live music listings for Indian cities, with quick links out to tickets.
- 🔮 **AI hints.** In-round hints that get more specific the more you buy — each costs points, and they never reveal the title or artist (enforced in the prompt *and* by a deterministic redaction filter). Requires a free `GROQ_API_KEY` (with optional `GEMINI_API_KEY` fallback) — see [AI hints](#ai-hints).

## How a round feels

1. Pick a vibe — genre, language, an artist, a difficulty — or just hit play and take what the shuffle gives you.
2. A clip fires. The bar drains. Four options stare back at you.
3. Tap your gut. Instant reveal: album art, the answer, and your points.
4. Rate the track, watch your streak, and run it back. Five rounds, one scorecard.

The whole session (all rounds plus their reveal data) is fetched in a single batched request, so answering never waits on a fresh network round-trip — the client reveals instantly and the server persists the score in the background afterward.

## Built with

**Frontend:** Vite + React 18 + TypeScript, Tailwind CSS, Framer Motion for the motion design, a hand-written Three.js/GLSL shader (LaserFlow) for the backdrop, Zustand for state, React Router, Axios.

**Backend:** Express + MongoDB (Mongoose), with an in-memory `dev-data.json`-backed store (`server/src/utils/devStore.ts`) so the app still runs without a database connection.

**Testing:** Vitest, covering scoring, streak multipliers, and XP math (`server/src/utils/gameLogic.test.ts`, `server/src/utils/xpUtils.test.ts`).

**Music data:** iTunes Search API for fast preview clips and default catalog search, Spotify (optional) for real stream-popularity signal, the culture-reel catalog, and richer artist search.

**Auth:** Clerk, with a first-class guest mode for everyone else (falls back to the app's own JWT/cookie auth when Clerk keys aren't configured).

## Project structure

```
client/    Vite + React frontend
  src/components/   game/, culture/, thread/, comment/, era/, user/, effects/ (LaserFlow), layout/, ui/
  src/pages/        Game, Home, EraPage, ThreadDetail, Profile, Tours, Leaderboard, Login, Register
  src/services/     API clients (api.ts, authService, cultureService, ...)
  src/stores/       Zustand stores
  src/config/       gameConfig.ts (difficulty timing, mirrors the server)

server/    Express + MongoDB backend
  src/routes/       auth, game, threads, comments, culture, tours, eras, users, ai
  src/controllers/  business logic per route group
  src/models/       User, GameScore, TrackRating, Thread, Comment, CultureSignal, CultureReview, Era, Tour, Track, RagChunk
  src/middleware/   auth.middleware.ts, security.middleware.ts, rateLimiter.ts, error.middleware.ts
  src/config/       env.ts, db.ts, gameConstants.ts (difficulty timing, curated artists, genre/language maps)
  src/utils/        gameLogic.ts, xpUtils.ts, jwtUtils.ts, clerkSync.ts, devStore.ts, apiResponse.ts
  src/ai/           llm.ts (provider seam), groqClient.ts, geminiClient.ts, prompts.ts (hint guardrails)
  src/seo/          crawlerMeta.ts (Open Graph tags for bot user-agents)
  src/data/         seed.ts

api/index.ts   Serverless entry point that wraps the Express app for Vercel
```

## API reference

All routes are served under the base path `/api/v1` (mounted in `server/src/app.ts`). Responses share a common envelope — `{ success, data }` on success, `{ success: false, error }` on failure.

**Auth model.** Most read endpoints are public. Write endpoints marked `auth` require a signed-in user — either a Clerk session (sent as a Bearer token) or the app's own JWT cookie from `/auth/login`. Game and culture endpoints use *optional* auth: they work for guests and simply persist more when you're signed in. Tour writes additionally require an admin id (`ADMIN_USER_IDS`).

| Group | Method & path | Auth | What it does |
|---|---|---|---|
| Health | `GET /health` (and `/api/v1/health`) | — | Liveness probe + Mongo connection status |
| Auth | `POST /auth/register` | — | Create a local account |
| | `POST /auth/login` | — | Local login |
| | `POST /auth/logout` | auth | End the session |
| | `GET /auth/me` | auth | Current user |
| Game | `GET /game/question` | optional | Fetch a single round (clip + 4 options) |
| | `GET /game/session` | optional | Fetch a whole game (1–10 rounds) with reveal data in one batched request |
| | `POST /game/answer` | optional | Submit a guess, get the reveal + score instantly |
| | `POST /game/rating` | optional | Rate a track 1–5 |
| | `GET /game/artists` | — | Curated artist pool |
| | `GET /game/artists/search?q=` | — | Live artist search (iTunes/Spotify) |
| | `GET /game/leaderboard?period=&scope=&scopeValue=` | optional | Daily/all-time boards, sliceable by artist/genre, with live rank |
| | `GET /game/history` | auth | Your recent rounds |
| | `GET /game/stats` | auth | Your aggregate stats |
| Threads | `GET /threads`, `GET /threads/:id` | — | List / read discussions |
| | `POST /threads`, `PUT`/`DELETE /threads/:id`, `POST /threads/:id/vote` | auth | Create / edit / vote |
| Comments | `GET /comments` | — | List comments for a thread |
| | `POST /comments`, `PUT`/`DELETE /comments/:id`, `POST /comments/:id/vote` | auth | Create / edit / vote |
| Culture | `GET /culture/catalog` | — | Curated Spotify-backed browse pool that feeds the culture reels |
| | `GET /culture/signals` | optional | Meaning votes + reactions for a set of tracks |
| | `GET /culture/reviews?trackId=&limit=` | — | Trending tracks + reviews |
| | `POST /culture/meaning`, `POST /culture/reaction`, `POST /culture/reviews` | optional¹ | Vote a lyric meaning, react, review |
| Tours | `GET /tours` | — | Live music listings |
| | `POST /tours`, `PUT /tours/:id` | admin | Create / update a tour record |
| AI | `POST /ai/hint` | — | Generate a round hint from the encrypted song token; specificity scales with `guessesUsed` |
| Eras | `GET /eras`, `GET /eras/:slug` | — | Music-era catalog |
| Users | `GET /users/:username` | — | Public profile |
| | `GET /users/me/threads`, `GET /users/me/comments`, `PUT /users/me` | auth | Your content / edit profile |

¹ Culture writes require sign-in when `REQUIRE_AUTH_FOR_CULTURE_WRITES=true`.

Rate limiting is applied per group — `authLimiter`, `apiLimiter`, `writeLimiter`, `voteLimiter`, `cultureWriteLimiter`, `gameLimiter`, and `aiLimiter` all live in `server/src/middleware/rateLimiter.ts`.

## Local development

This is an npm workspaces monorepo, so a single install from the repo root pulls in dependencies for both client and server:

```
npm install
```

Run the backend:

```
npm run dev:server
```

Run the frontend:

```
npm run dev:client
```

- Frontend: http://127.0.0.1:5173
- Backend: http://127.0.0.1:5000/health

Run the test suite from the repo root:

```
npm test
```

## AI hints

**Groq** (`llama-3.3-70b-versatile`) generates the hint text. Grab a free API key at [console.groq.com](https://console.groq.com) — no card required — and set `GROQ_API_KEY` in `server/.env`. **Gemini** (`gemini-flash-lite-latest`) is the optional fallback: set `GEMINI_API_KEY` (free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) and it takes over whenever Groq is unconfigured or a call fails — free-tier rate limits stop being an outage. With neither key, the `/ai` routes return 503 and everything else keeps working.

The round's encrypted song token is decoded server-side, and a tiered prompt (vague → genre/era → near-giveaway, scaling with guesses used) writes the clue. The title and artist are never revealed — that's enforced in the prompt *and* by a deterministic redaction filter on the model's output (`server/src/ai/prompts.ts`). Each hint costs points (`HINT_POINT_PENALTY` in `server/src/utils/gameLogic.ts`, mirrored client-side).

## Environment variables

### Frontend

Create `client/.env` from `client/.env.example`.

Required for production:

- `VITE_API_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_APPLE_MUSIC_COUNTRY`

Optional analytics:

- `VITE_UMAMI_WEBSITE_ID` enables Umami analytics in production builds
- `VITE_UMAMI_SRC` overrides the tracker script URL (defaults to Umami Cloud)
- `VITE_UMAMI_HOST_URL` sets Umami's `data-host-url` for self-hosted/proxied collectors
- `VITE_UMAMI_DOMAINS` limits tracking to a comma-separated hostname allowlist

### Backend

Create `server/.env` from `server/.env.example`.

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Mongo connection string (required in production) |
| `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | The API needs both to verify Clerk sessions |
| `JWT_SECRET` | Local JWT signing key (32+ chars in production) |
| `GAME_SECRET` | HMAC/AES key used to encrypt song reveal tokens so answers can't be tampered with |
| `GAME_ARTIST_QUERY` | Comma-separated default artist pool (falls back to the curated list if unset) |
| `GAME_ITUNES_COUNTRY` | iTunes Search API country/region code |
| `GAME_ITUNES_LIMIT` | Track limit per iTunes query (clamped 20–200, default 40) |
| `GAME_ITUNES_TIMEOUT_MS` | iTunes fetch timeout (clamped 1500–10000ms, default 4500ms) |
| `GAME_MAX_QUERY_TERMS` | Max artist queries batched per fetch (clamped 2–12, default 6) |
| `GAME_TRACK_CACHE_MS` | Song-pool cache TTL (default 10 minutes) |
| `GROQ_API_KEY` | Groq LLM key for the AI hints — free at [console.groq.com](https://console.groq.com), no card required. Optional: with neither this nor `GEMINI_API_KEY` set, the `/ai` routes return 503 and the rest of the app is unaffected |
| `GROQ_MODEL` | Groq model id (default `llama-3.3-70b-versatile`) |
| `GEMINI_API_KEY` | Gemini LLM key, the fallback provider — free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Used when Groq is unconfigured or a Groq call fails |
| `GEMINI_MODEL` | Gemini model id (default `gemini-flash-lite-latest` — keep a rolling `-latest` alias; pinned models age out of the free tier) |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Client Credentials for Spotify public catalog search and the culture-reel catalog |
| `GAME_SPOTIFY_MARKET` | Spotify market code for popularity/metadata (default `US`) |
| `GAME_SPOTIFY_TRACK_SEARCH` | Set `true` to use Spotify (instead of iTunes) for game track search |
| `CLIENT_ORIGIN` | Comma-separated allowed CORS origins |
| `ADMIN_USER_IDS` | Comma-separated Mongo user ids allowed to create/update tour records |
| `REQUIRE_AUTH_FOR_CULTURE_WRITES` | Set `true` if meaning votes, reactions, and reviews should require sign-in |

Spotify is used only for public catalog search through Client Credentials — game track search stays on iTunes previews by default for speed; set `GAME_SPOTIFY_TRACK_SEARCH=true` only if you want to test Spotify preview URLs. Do not put `SPOTIFY_CLIENT_SECRET` in frontend code. If you later add user-specific Spotify features, use Authorization Code with PKCE or a backend Authorization Code flow with the minimum scopes needed.

`CLIENT_ORIGIN` supports comma-separated values, for example:

```
CLIENT_ORIGIN=http://localhost:5173,https://your-frontend-domain.onrender.com
```

Production deploys intentionally fail if `MONGODB_URI`, Clerk keys, `JWT_SECRET`, `GAME_SECRET`, or `CLIENT_ORIGIN` are missing or still using placeholder values. Clerk test keys (`pk_test_` / `sk_test_`) are blocked in production.

If MongoDB is unavailable in development, the backend falls back to an in-memory store seeded from `server/dev-data.json`.

## Deploy to Vercel

This repo is Vercel-ready as a single project:

- Frontend: Vite build from `client`
- Backend: Express API through `api/index.ts`
- API base path: `/api/v1`

Vercel should use the root project directory with these settings from `vercel.json`:

- Install command: `npm ci --include=dev`
- Build command: `npm run build:vercel`
- Output directory: `client/dist`

Required Vercel environment variables:

```
NODE_ENV=production
MONGODB_URI=your_mongodb_uri
CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_publishable_key
CLERK_SECRET_KEY=sk_live_your_clerk_secret_key
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_publishable_key
JWT_SECRET=your_32_plus_character_jwt_secret
GAME_SECRET=your_32_plus_character_game_secret
GAME_ARTIST_QUERY=the weeknd, kanye west, travis scott, drake
GAME_ITUNES_COUNTRY=us
GAME_ITUNES_LIMIT=40
GAME_ITUNES_TIMEOUT_MS=4500
GAME_MAX_QUERY_TERMS=6
GAME_TRACK_CACHE_MS=600000
GAME_SPOTIFY_MARKET=US
GAME_SPOTIFY_TRACK_SEARCH=false
VITE_API_URL=/api/v1
VITE_APPLE_MUSIC_COUNTRY=IN
VITE_UMAMI_WEBSITE_ID=your_umami_website_id
VITE_UMAMI_SRC=https://cloud.umami.is/script.js
ADMIN_USER_IDS=your_mongo_user_id
REQUIRE_AUTH_FOR_CULTURE_WRITES=true
```

Optional Spotify artist search and culture catalog:

```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

Optional Umami self-host/proxy settings:

```
VITE_UMAMI_HOST_URL=https://analytics.your-domain.com
VITE_UMAMI_DOMAINS=your-domain.com,www.your-domain.com
```

`vercel.json` also configures the serverless function (`api/index.ts`, 512MB memory, 30s max duration), a rewrite that routes bot user-agents on `/profile/*`, `/thread/*`, and `/era/*` to the API for server-rendered Open Graph tags (see [Security & performance](#security--performance)), long-lived caching for static assets, and a SPA fallback rewrite (`/* → /index.html`).

### Clerk on Vercel

If Vercel shows Clerk in "Development mode," the deployment is still using a `pk_test_` key. Use the live Clerk application keys in Vercel:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

Do not leave these variables as blank strings in Vercel. A blank `VITE_CLERK_PUBLISHABLE_KEY` means the browser cannot boot Clerk, and a blank `CLERK_PUBLISHABLE_KEY` means the API cannot verify Clerk sessions.

In the Clerk dashboard, add your Vercel production domain to the allowed origins and redirect URLs. Also check the Google social connection settings: first-time Google users need sign-up/account creation enabled, otherwise Clerk can return "The External Account was not found" when they try Google on the sign-in screen.

If a Vercel URL returns 401 Unauthorized before the app loads, check Vercel Project Settings → Deployment Protection. That is Vercel blocking the deployment before React or Clerk runs.

`CLIENT_ORIGIN` is optional on Vercel because the backend can use Vercel's automatic `VERCEL_URL`. Set it manually only when you need to allow extra origins, for example a custom domain:

```
CLIENT_ORIGIN=https://your-domain.com,https://your-project.vercel.app
```

Before pushing:

```
npm run build:vercel
git status --short
```

Then push to GitHub and import the repo into Vercel. Use root directory `/`, not `client` or `server`.

## Build checks

From repo root:

```
npm run build
```

This runs `tsc --noEmit` typechecking followed by the server and client production builds. Run `npm test` to run the Vitest suite covering scoring, streaks, and XP math.

## Game design

The 5-second guess game adapts to the difficulty you pick.

- **The clock scales with difficulty.** Easy gives you 10 seconds, medium 7, hard 5. The countdown and the server's speed-bonus window read the same numbers (`client/src/config/gameConfig.ts` and `server/src/config/gameConstants.ts`), so a longer clock always means a longer window to earn a speed bonus on — they can't drift apart.
- **Difficulty is popularity-aware.** Easy leans toward recent, well-known tracks (2018+); medium sits in the familiar-but-not-obvious middle (2012+); hard reaches for older, longer deep cuts. The signal is Spotify's real stream-based popularity when Spotify credentials are present; otherwise it falls back to an iTunes search-rank approximation, and finally to a release-year/duration heuristic. Set `GAME_SPOTIFY_TRACK_SEARCH=true` for the richest tiers.
- **Scoring.** A correct answer is worth 100 points plus a speed bonus (up to 60 points, scaled by how much of the difficulty's time window is left when you answer). A streak multiplier climbs by 0.25 every 3 correct answers in a row, capped at 2x, and applies to the whole score.
- **XP and levels.** A wrong answer earns 5 XP; a correct one earns 50 XP plus a streak bonus (up to 50 more) plus half of any speed bonus. XP thresholds unlock level titles from "XO Initiate" up through "Dawn FM Legend."
- **The reveal is instant.** A whole session (1–10 rounds, with reveal data) is fetched in one batched request up front, and answering scores in memory and reveals immediately — the server persists the score afterward without blocking the response, so the correct/wrong reveal shows up instantly even under database latency.
- **Songs keep mixing.** Recently-served correct answers are remembered per filter set (server-side) and the client also passes a recent-song exclusion list, so you don't get the same track twice in a session.
- **Guest identity.** Every guest gets a stable, deterministic handle (144 possible combinations, like "Midnight Vinyl" or "Silent Echo") derived from their session cookie, so they can rank on leaderboards without an account.

## Security & performance

- **Security headers.** Helmet sets baseline headers on the API; Vercel's edge config layers on HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a locked-down `Permissions-Policy`, and a report-only Content-Security-Policy scoped to Clerk, iTunes/Spotify artwork CDNs, and Google Fonts.
- **Rate limiting.** Auth, general API, write, vote, culture-write, and game-answer endpoints each have their own limiter (`server/src/middleware/rateLimiter.ts`), so no single surface can be hammered independently of the others.
- **Tamper-resistant reveals.** Song identity is carried in an encrypted token (AES-256-GCM) issued with each question and validated on answer submission, so a client can't spoof which track it's answering for.
- **SEO for crawlers.** Bot user-agents hitting `/profile/*`, `/thread/*`, or `/era/*` are rewritten to the API (`server/src/seo/crawlerMeta.ts`), which returns server-rendered Open Graph tags for rich link previews — regular browser traffic still gets the normal SPA.
- **LCP-safe entrances.** Page and hero entrance animations use transform-only motion (a GPU-composited slide), never an `opacity: 0` fade — Chrome skips transparent elements when choosing the Largest Contentful Paint candidate, so fading the hero in from zero used to delay the headline by the whole animation. Reduced-motion users get an instant, static render.
- **Eager landing route.** The `/` route (the game) is statically imported, so the first screen ships in the initial bundle instead of waiting on a second lazy-chunk fetch. Every other route stays code-split.
- **Non-blocking fonts.** Barlow Condensed is preloaded as a `woff2` with a `size-adjust` fallback and `display=swap`, so text paints immediately in the fallback face and swaps in without layout shift when the web font is ready.
- **Lazy, self-governing WebGL.** The Three.js LaserFlow backdrop (the single heaviest dependency) is lazy-loaded, mounted only after the page is idle, and skipped entirely for small screens and reduced-motion users. While running it adapts its pixel ratio to the live frame rate and pauses when off-screen or when the tab is hidden.
- **Code-split vendors.** React, Three.js, Framer Motion, and Clerk are split into separate chunks so a change in one doesn't bust the cache for the others.
- **Serverless cold-start.** On Vercel, the MongoDB connection is kicked off during function cold-start instead of on the first request, avoiding a connect-then-query waterfall.

Audit the bundle any time with `npm run build` from `client` — Vite prints the gzipped size of every chunk.

## Notes

- Apple Music data on the culture page is powered by the iTunes Search API.
- The culture-reel catalog is a curated Spotify pool across 14 artists spanning R&B, hip-hop, pop, dance, Bollywood, and Punjabi — round-robined into a browsable feed and cached for 10 minutes. Because the Spotify app runs in dev mode, real per-track popularity and genre data aren't available; the catalog synthesizes a stable popularity score from release year and track ID instead. Game track search stays on iTunes by default, and `GET /game/artists/search` still uses Spotify/iTunes live search when credentials are present.
- Lyrics meaning votes, reactions, reviews, and culture voting are persisted through the backend, deduped per signed-in user or guest cookie.
- The tours page uses live District public music listings, which is useful for MVP but not as stable as an official partner API.
