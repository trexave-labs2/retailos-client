# RetailOS Client

Next.js frontend for the RetailOS Flask API.

## Architecture

```
Browser
  │
  │ HTTPS + credentialed REST requests
  ▼
retailos-client (Next.js)
  │
  │ REST
  ▼
retailos-server (Flask)
  │
  ▼
PostgreSQL
```

The client no longer owns authentication, database access, inventory logic, sales transactions, reports, or server-side API routes. The Flask server is the source of truth.\n\nClient authentication remains on `POST /auth/login`, `GET /auth/me`, and `POST /auth/logout`, using the Client session cookie and the retail account password. Platform administrators sign in through the separate `/admin/auth/*` routes and an independent Admin credential/session. The Client login must never authenticate against the Admin password.

## Run locally

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Then:

```bash
npm install
npm run dev
```

The server must be running separately and must allow the frontend origin with:

```env
FRONTEND_URL=http://localhost:3000
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAMESITE=Lax
```

For a production frontend hosted on another domain, set `FRONTEND_URL` to the exact frontend origin and use HTTPS. The server's cross-origin session cookie should use `SameSite=None` and `Secure=true`.

## Supported server-backed UI

- Authentication
- Store dashboard
- Products
- Inventory and stock adjustments
- Sales/POS
- Transactions
- Customers
- Low-stock alerts
- Settings

Purchases, reports, employee roles, and notification APIs were removed from the client because they are not currently exposed by the Flask server contract.

## Guided tour ("Learn the app")

New users see a short welcome on the dashboard with **Start the tour** or **Skip for now**. A spotlight and instruction card then point at real parts of the interface. Each step has Back, Next, Skip step (for steps that ask the user to try something), Pause and Exit, plus a "Step 2 of 5" indicator.

- **Chapters:** Getting started, Recording a sale, Products & stock, Customers, Transactions & debts, Low-stock alerts. Defined in `lib/tour-core.mjs`.
- **Re-entry:** the **Learn the app** button (header, "Help" on phones) lists every chapter, offers Resume for an interrupted tour, and replays finished ones. **Tour this page** starts the chapter for the page you are on.
- **Action steps** unlock only after the real click/input is observed. The tour never presses buttons or submits data for the user, and it never calls the API.
- **Persistence:** progress (welcome shown/dismissed, completed chapters, interrupted position) is stored in `localStorage` under `retailos:tour:v1:user:<id>`. It holds only chapter ids and step numbers, is per account per browser, and is not synced across devices because the Flask API has no preferences endpoint. Users who dismiss or finish the welcome are not shown it again on later logins.
- **Adding or changing a step:** put a `data-tour="name"` attribute on the real element, then reference `name` in `CHAPTERS`. `npm test` fails if a step points at an element that no longer exists.

## API contract

The browser uses one same-origin request strategy: it calls `/api/*` on the Next.js origin, and the Next.js rewrite forwards requests to the Flask API. The browser therefore does not depend on third-party-cookie behavior.

Examples:

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /product/list?store_id=...`
- `POST /product/create`
- `PATCH /product/update`
- `DELETE /product/delete`
- `POST /product/adjust`
- `POST /sales`
- `GET /sales?store_id=...`
- `GET /dashboard?store_id=...`
- `GET /customers?store_id=...`
- `POST /customers`
- `GET /alerts?store_id=...`
- `POST /alerts/generate-low-stock?store_id=...`
- `POST /alerts/resolve?store_id=...&id=...`

## Production API and session cookies

Set `RETAILOS_API_ORIGIN` to the upstream Flask origin in `.env.local` for development and in the Vercel runtime environment for production. For example, local development can use `http://127.0.0.1:5000` and production can use the deployed HTTPS API origin. Browser requests always use `/api`; do not set `NEXT_PUBLIC_API_URL`. The rewrite keeps the browser request on the frontend origin. A protected API `401` redirects to `/login?reason=session-expired`, where the user sees an explanation. Server/network failures during initial session verification show a retry screen rather than silently treating the user as logged out.
