# Event Finance Manager

Mobile-first event finance web application built with Next.js, Auth.js, MongoDB/Mongoose and Tailwind. Designed for Vercel.

## Run locally

1. Install Node.js 20.9+ (use the Node.js version supported by your chosen Next.js release).
2. `npm install`
3. Copy `.env.example` to `.env.local` and set `MONGODB_URI`, `AUTH_SECRET` (generate with `openssl rand -base64 32`), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
4. `npm run seed` (once only, creates the first Super Admin).
5. `npm run dev` and visit http://localhost:3000/login.

## Workflow

Super Admin creates an event, activates it, creates managers and assigns them to the event. The active event is the landing screen for assigned users. Managers add income immediately, but expenses remain PENDING until approved by the Super Admin. Only approved expenses lower the displayed balance. Complete an event only after pending expenses are resolved.

## Deploy

Push repository to GitHub and import into Vercel. Set `MONGODB_URI`, `AUTH_SECRET`, and `AUTH_URL` (production URL) in Vercel environment variables. Provision a MongoDB Atlas cluster and configure secure network access. Seed admin from a trusted local machine against production database before first login. Do not expose seed credentials on the client.

## Scope and follow-ups

This is a working MVP starter, **not yet a production-audited accounting application**. Before live rollout add: login rate limiting, friendly server-action error handling, pagination, detailed reports and PDF exports, password change/reset and manager deactivation, controlled correction/reversal workflows, and full financial audit/reconciliation tests. Audit writes and expense changes currently occur as separate database writes, so guaranteed all-or-nothing audit logging requires MongoDB transactions on a replica set. PWA manifest is present; full offline fallback/service worker is not yet implemented. CSV/PDF reporting not included in this MVP.
