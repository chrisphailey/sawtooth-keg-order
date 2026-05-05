# Sawtooth Brewery Keg Ordering

A full-stack keg ordering and admin management app for Sawtooth Brewery. Customers submit keg requests via a public form; admins manage orders, confirm pickups, and complete Idaho keg receipts.

## Run & Operate

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env vars: `DATABASE_URL`, `SESSION_SECRET`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
- Optional (mock Clover works without): `CLOVER_API_TOKEN`, `CLOVER_MERCHANT_ID`

## Stack

- **Frontend**: React + Vite (artifact: `sawtooth-keg`, path `/`)
- **Backend**: Express 5 (artifact: `api-server`, path `/api`)
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Auth**: Clerk (admin-only; public keg order form is unauthenticated)
- **API contract**: OpenAPI spec → Orval codegen → `@workspace/api-client-react`
- **Payments**: Mock Clover pre-auth/capture (`lib/clover.ts`, demo mode)
- **Node.js**: 24 / **TypeScript**: 5.9 / **pnpm workspaces**

## Where things live

- `artifacts/sawtooth-keg/src/App.tsx` — Clerk provider, router, all routes
- `artifacts/sawtooth-keg/src/pages/` — KegOrderForm, admin/*, pickup/*
- `artifacts/api-server/src/routes/` — beers, orders, payments, pickup, receipts, dashboard
- `lib/db/src/schema/` — all DB tables (beers, orders, paymentAuthorizations, pickupSchedule, kegReceipts)
- `lib/api-spec/` — OpenAPI spec (source of truth for API contract)
- `lib/clover.ts` — mock Clover payment integration

## Architecture decisions

- Admin routes (`/admin/*`, `/pickup/*`) protected via Clerk `Show when="signed-in"` + redirect
- Public keg order at `/keg-order` — no auth, embeddable as iframe
- Payment pre-authorization happens at order submission; capture happens when admin confirms
- Mock Clover: falls back to mock response when `CLOVER_MERCHANT_ID`/`CLOVER_API_TOKEN` not set
- Clerk keys are auto-provisioned via Replit's Clerk integration

## Product

- **Customer**: `/keg-order` — reserve a keg (beer selection, pickup date, deposit pre-auth)
- **Admin Dashboard** (`/admin`): stats + recent orders
- **Admin Orders** (`/admin/orders`): filterable order list with confirm/cancel actions
- **Admin Beers** (`/admin/beers`): keg inventory CRUD
- **Admin Calendar** (`/admin/calendar`): monthly pickup calendar
- **Pickup Forms** (`/pickup/:id/forms`): Idaho keg receipt + customer signature
- **Pickup Receipt** (`/pickup/:id/receipt`): read-only printable receipt

## User preferences

- Demo/mock Clover only — no real payment credentials needed
- Amber/warm palette throughout (`hsl(28, 90%, 45%)` primary)

## Gotchas

- Beer seeding: use `executeSql` or raw SQL — `/api/beers` POST requires auth
- Clover mock returns a fake `cloverPaymentId` when env vars are absent
- Admin API routes require Clerk JWT (`requireAuth` middleware from `@clerk/express`)

## Pointers

- Clerk auth skill: `.local/skills/clerk-auth/`
- pnpm workspace skill: `.local/skills/pnpm-workspace/`
- DB schema: `lib/db/src/schema/index.ts`
- OpenAPI spec: `lib/api-spec/openapi.yaml`
