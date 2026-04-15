# Eventflow

B2B event attendance tracking with Next.js (App Router), PostgreSQL, Prisma, NextAuth, Resend email, and Zoom Server-to-Server OAuth.

**Repository:** [https://github.com/dankoney/eventflow](https://github.com/dankoney/eventflow)

---

## What you need

- **Node.js** 18+ (LTS recommended). On **Windows on ARM**, use the **x64** Node installer or run the app under **WSL2** so Prisma’s query engine matches your Node architecture (see `prisma/schema.prisma` comment).
- **PostgreSQL** 14+ reachable from the app host.
- Accounts for **Resend** (email) and **Zoom** (Server-to-Server OAuth) if you use those features.

---

## Clone and run locally

```bash
git clone https://github.com/dankoney/eventflow.git
cd eventflow
cp .env.example .env
# Edit .env: set DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, etc.

npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If there are no users yet, you’ll be sent to **`/setup`** to create the first organization and admin.

---

## Environment variables

Copy `.env.example` to `.env` and fill in values.

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql://...`) |
| `NEXTAUTH_URL` | Yes | Public base URL of the app (e.g. `https://events.example.com`) |
| `NEXTAUTH_SECRET` or `AUTH_SECRET` | Yes | Secret for signing sessions (long random string) |
| `RESEND_API_KEY` | For email | Resend API key |
| `RESEND_FROM` | No | Default `"From"` address (see `src/lib/email.ts`) |
| `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_ACCOUNT_ID` | For Zoom | Zoom Server-to-Server OAuth credentials |
| `ZOOM_HOST_USER_ID` | No | Defaults to `"me"` in `src/lib/zoom.ts` |

Never commit `.env` — it is listed in `.gitignore`.

---

## Database (Prisma)

- **Local / first deploy:** run migrations after pulling code:
  - `npx prisma migrate dev` (development)
  - `npx prisma migrate deploy` (production / VPS)
- If the repo has no `prisma/migrations` yet on your machine, create the initial migration with `npx prisma migrate dev --name init` once, then commit the `prisma/migrations` folder so production can run `migrate deploy`.

`npm install` runs `prisma generate` via `postinstall` so the Prisma Client is ready before `npm run build`.

---

## Deploy on a VPS (e.g. Plesk)

High-level checklist — adapt to your host’s Node/Git UI:

1. **PostgreSQL**  
   Create a database and user in Plesk or your provider. Note host, port, DB name, user, password.

2. **Get the code**  
   Either **Git** (Plesk “Git” Remote repository → pull) or upload/extract a release archive.

3. **Environment**  
   In Plesk (or systemd), set the same variables as in `.env`—especially `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and Resend/Zoom keys.

4. **Install and build** (SSH into the server, from the app directory):

   ```bash
   npm ci
   npx prisma migrate deploy
   npm run build
   ```

5. **Run**

   **Option A — Plesk “single startup file” (recommended)**  
   Some Plesk Node.js versions cannot pass `start` to `node_modules/next/dist/bin/next`, so use the included **`server.js`** at the project root:

   - In Plesk → Node.js → **Application startup file**: `server.js` (not the long path under `node_modules`).
   - Plesk usually sets `PORT`; the server listens on **`0.0.0.0`** so the reverse proxy can reach it.
   - After `npm run build`, click **Restart App** in Plesk.

   **Option B — CLI** (VPS without that limitation, or PM2):

   ```bash
   npm run start
   ```

   Bind to the port your reverse proxy expects (often set via `PORT`).

6. **HTTPS & domain**  
   Point your domain at the VPS; enable SSL in Plesk. Set `NEXTAUTH_URL` to the exact public URL (including `https://`).

7. **First login**  
   Visit the site root; complete **`/setup`** if no users exist, or sign in if the database was restored with users.

---

## Useful scripts

| Script | Command |
|--------|---------|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Production server | `npm start` (Next default) or `npm run start:plesk` (same as `server.js` for Plesk) |
| Prisma Client | `npm run prisma:generate` |
| Migrations (dev) | `npm run prisma:migrate` |

---

## License

Private / internal use unless you add an explicit license.
