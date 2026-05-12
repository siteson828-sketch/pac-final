---
name: pac-final project context
description: Next.js public art collections site on Vercel with Neon Postgres
type: project
---

Next.js app at pac-final.vercel.app. Database is Neon Postgres via DATABASE_URL env var.

**Why:** Public art marketplace — browse museum artworks (Met, AIC, Cleveland, Rijksmuseum, V&A, SMK, Smithsonian, Harvard) and buy as prints.

**How to apply:** After every change, commit with a descriptive message and push to main.

Key files:
- `pages/index.js` — main frontend (inline HTML/CSS/JS in dangerouslySetInnerHTML)
- `pages/api/artworks.js` — artwork query API
- `pages/api/sync.js` — museum sync API (runs via vercel.json cron daily)
- `pages/sync.js` — duplicate sync logic (also a page route, separate from api/sync.js)
- `lib/db.js`, `lib/fetchers.js` — unused helper modules (logic is inlined in API routes)
- `vercel.json` — cron: runs /api/sync at midnight daily

Known issue: `next.config.js` is in `pages/` instead of the project root — needs to be moved.
