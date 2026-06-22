# Squash Platform

Monorepo for the Squash mobile application, administrative web portal, REST API, and background worker.

## Requirements

- Node.js 22+
- Corepack
- Docker

## Start locally

```bash
npm install
docker compose up -d
cp .env.example .env
npm run db:migrate
npm run dev
```

The web/API runs on `http://localhost:3000`, MinIO on `http://localhost:9001`, and the Expo app is started by the mobile workspace.

## Web workspace

The role-aware administrative workspace is available at `http://localhost:3000/workspace`.
The legacy `/admin` URL redirects there.

1. Run `npm run db:migrate` after pulling schema changes.
2. Start the API/web app with `npm run dev:web`.
3. Create an account at `/signup` and verify it using the development URL printed by the web server.
4. A new account can create a club and becomes its owner automatically.
5. To grant platform-wide administration to an existing account, run:

```bash
npm run admin:promote -- user@example.com
```

Club owners and admins can invite members by email, change member roles, revoke or resend
invitations, and remove members. Invitations expire after seven days. Without a Resend key,
development email events are logged by the worker instead of being delivered.

## Deployment

- Select `railway.web.json` for the Railway web/API service.
- Select `railway.worker.json` for the Railway worker service.
- Provision PostgreSQL and provide the variables from `.env.example` to both services.
- Create the private R2 bucket and replace the local MinIO credentials in production.
- Replace the EAS project ID and native bundle identifiers in `apps/mobile/app.json` before store builds.

## Architecture rules

- Route handlers own HTTP concerns only.
- Business rules live in `packages/domain` and `packages/server`.
- Database records never cross the API boundary directly; DTOs come from `packages/contracts`.
- Web and mobile share contracts, API clients, translations, and design tokens, but not UI components.
- Open-play scores never contribute to official statistics.
