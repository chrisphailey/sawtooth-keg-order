# Sawtooth Keg Order Flow

Full-stack keg ordering app for Sawtooth Brewery.

## Stack

- pnpm workspace monorepo
- Vite + React client in `artifacts/sawtooth-keg`
- Express API in `artifacts/api-server`
- Drizzle/Postgres schema in `lib/db`

## Local Setup

```sh
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install
cp .env.example .env
pnpm db:push
pnpm run dev:api
pnpm run dev:web
```

For local development, run the API and web dev servers in separate terminals. Set `PORT` before each command if you need a specific port.

## Production Build

```sh
pnpm run build
pnpm run start
```

The production API serves the built Vite app from `artifacts/sawtooth-keg/dist/public`, so Railway only needs one service.

## Railway Deployment

1. Push this repository to GitHub.
2. Create a Railway project from the GitHub repo.
3. Add a Railway Postgres database and copy its `DATABASE_URL` into the app service.
4. Add the required app environment variables from `.env.example`.
5. Deploy. Railway will use `railway.json` to run `pnpm run build` and `pnpm run start`.

Required variables:

- `DATABASE_URL`
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`

Optional integrations:

- Clover payments: `CLOVER_API_BASE`, `CLOVER_MERCHANT_ID`, `CLOVER_API_TOKEN`
- Email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ADMIN_EMAIL`
- App links in email: `APP_BASE_URL`
