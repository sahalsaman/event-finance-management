# Event Finance Manager

Mobile-first event finance web application built with Next.js, Auth.js, MongoDB/Mongoose and Tailwind. Designed for Vercel.

## Run locally

1. Install Node.js 20.9+ (use the Node.js version supported by your chosen Next.js release).
2. `npm install`
3. Set `MONGODB_URI`, `AUTH_SECRET` (generate with `openssl rand -base64 32`), `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD` (at least 6 characters) in `.env.local`. Upstash is not required for local development; login rate limiting is enabled in production only.
4. `npm run seed` (once only, creates the first Super Admin).
5. `npm run dev` and visit http://localhost:3000/login.

## Workflow

Super Admin creates an event and can set an event-wide income target, creates managers, assigns them from the event's Add Manager popup, and sets individual targets for assigned managers. The Events page shows collected income, target progress and remaining target balance for each event and ranks managers by income collected; it also shows each manager's expenses and cumulative handovers paid to the Super Admin. Admins can record manager handovers up to that manager's unhanded recorded income; income edits cannot reduce recorded income below completed handovers. Managers with no income or approved/pending expenses can be unassigned. The active event is the landing screen for assigned users and shows the event-wide goal to the Super Admin and the individual goal to each manager. After income is recorded, the app opens an e-receipt using `public/ereciept.png`; both managers and Super Admins can download or share authorized receipts from the receipt page and transaction history. Managers add income immediately, but expenses remain PENDING until approved by the Super Admin. Only approved expenses lower the displayed balance. An event cannot be marked completed while pending expenses remain.

## Deploy

Push repository to GitHub and import into Vercel. Set `MONGODB_URI`, `AUTH_SECRET`, `AUTH_URL` (production URL), `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` in Vercel environment variables. Provision a MongoDB Atlas cluster and configure secure network access. Create an Upstash Redis database and use its REST URL and token. Login attempts are limited to 10 per IP and 5 per normalized email over a rolling 15-minute window. Seed admin from a trusted local machine against production database before first login. Do not expose seed credentials on the client.

Production login requires the Upstash rate-limit credentials. If the login page displays a temporary availability error in production, configure or restore `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the environment and restart/redeploy the app.

## Scope and follow-ups

This is a working MVP starter, **not yet a production-audited accounting application**. Before live rollout add: login rate limiting, friendly server-action error handling, pagination, detailed reports and PDF exports, password change/reset and manager deactivation, controlled correction/reversal workflows, and full financial audit/reconciliation tests. Audit writes and expense changes currently occur as separate database writes, so guaranteed all-or-nothing audit logging requires MongoDB transactions on a replica set. PWA manifest is present; full offline fallback/service worker is not yet implemented. CSV/PDF reporting not included in this MVP.
