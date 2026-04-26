# Raw XO

Raw XO is a cinematic music culture platform with:

- a 5-second guess game
- a culture page with lyric meaning, reactions, reviews, and lyric guessing
- tours for Indian cities
- Clerk-ready auth

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

`CLIENT_ORIGIN` supports comma-separated values, for example:

```env
CLIENT_ORIGIN=http://localhost:5173,https://your-frontend-domain.onrender.com
```

If MongoDB is unavailable in development, the backend falls back to `server/dev-data.json`.

## Deploy from GitHub

The cleanest self-serve path for this repo is:

1. Frontend on Render Static Site
2. Backend on Render Web Service
3. Repo hosted on GitHub

This repo already includes [render.yaml](C:/Raw_Xo/render.yaml) to help with that.

### 1. Push to GitHub

From the repo root:

```bash
git add .
git commit -m "Prepare Raw XO for deployment"
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
CLIENT_ORIGIN=https://your-frontend-domain.onrender.com
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

## Notes

- Apple music data on the culture page is powered by the iTunes Search API.
- Lyrics meaning, reactions, reviews, and culture voting are persisted through the backend.
- The tours page uses live District public music listings, which is useful for MVP but not as stable as an official partner API.
