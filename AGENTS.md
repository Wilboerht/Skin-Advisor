<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project commands

- Dev: `npm run dev` (webpack)
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Test: `npm test`
- Build (must use webpack): `npm run build`
- Production prepare: `node scripts/prepare-production.js` (loads `.env.production`, runs `prisma generate` + `migrate deploy`)
- Deploy entry: `pm2 start ecosystem.config.js` or `docker compose --env-file .env.production up -d --build`
