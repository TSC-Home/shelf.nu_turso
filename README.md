<a href="https://www.shelf.nu/" target="_blank">
<img width="100%" src="./apps/webapp/public/static/images/readme-cover.jpg" alt="Shelf.nu" />
</a>

<h3 align="center">Open-source asset management — SQLite/Turso self-hosted fork</h3>

<p align="center">
  <a href="https://github.com/Shelf-nu/shelf.nu/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Shelf-nu/shelf.nu?label=License" alt="License" /></a>
</p>

---

This is a self-hosted fork of [Shelf.nu](https://github.com/Shelf-nu/shelf.nu) that replaces all cloud dependencies with self-hostable alternatives:

| Original            | This fork                                                  |
| ------------------- | ---------------------------------------------------------- |
| Supabase PostgreSQL | SQLite (embedded) or [Turso](https://turso.tech/) (libSQL) |
| Supabase Auth       | Custom email+password auth (bcryptjs + JWT)                |
| Supabase Storage    | Local filesystem or any S3-compatible bucket               |
| pg-boss job queue   | node-cron + SQLite-backed job table                        |
| Stripe paywalls     | Removed — all features always enabled                      |

The result is a single Docker Compose stack with no external services required.

## Features

- **QR asset tags** — Generate and print QR codes. Scan with any phone to view, check out, or report an asset.
- **Bookings and reservations** — Schedule equipment, prevent double-bookings, calendar integration.
- **Custody tracking** — Assign assets to team members. Know who has what at all times.
- **Location management** — Hierarchical locations (buildings, floors, rooms, shelves).
- **Team roles** — Owner, Admin, Base, and Self Service roles with granular permissions.
- **Custom fields** — Add any metadata to assets: purchase date, warranty, serial numbers, condition.
- **Categories, tags, kits** — Bundle assets into kits and manage them as a unit.
- **CSV import/export** — Bulk import assets from spreadsheets. Export for reporting.
- **Asset reminders** — Schedule alerts for maintenance, calibration, warranty expiry.
- **Audit trail** — Notes and activity logs on every asset.
- **Multi-workspace** — Manage separate inventories for different organizations or departments.

## Quick Start (Docker)

```bash
# Download the compose file
curl -O https://raw.githubusercontent.com/<your-org>/<your-repo>/main/docker-compose.yml

# Edit the environment variables (at minimum: SESSION_SECRET, INVITE_TOKEN_SECRET)
$EDITOR docker-compose.yml

# Start
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) and create your first account.

Data is stored in a named Docker volume (`shelf_data`) — it survives container restarts and updates.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) >= 22.20.0
- [pnpm](https://pnpm.io/) >= 9.15.4

### 1. Clone and install

```bash
git clone <your-repo-url>
cd shelf.nu_turso
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

```env
# Database — use file: for local SQLite (no setup needed)
DATABASE_URL="file:./dev.db"

# Auth secrets — generate with: openssl rand -hex 32
SESSION_SECRET="<your-random-secret>"
INVITE_TOKEN_SECRET="<your-random-secret>"

# Email — leave RELAY_API_KEY empty to skip email sending in dev
RELAY_API_KEY=""
SMTP_FROM="Shelf <noreply@localhost>"
SEND_ONBOARDING_EMAIL="false"

# Storage — local filesystem for dev
STORAGE_DRIVER="local"
UPLOAD_DIR="./dev-uploads"
```

Everything else in `.env.example` is optional for local development.

### 3. Set up the database

```bash
# Generate the Prisma client and apply the initial migration
pnpm webapp:setup
```

This creates `dev.db` at the repo root (or wherever `DATABASE_URL` points).

### 4. Start the dev server

```bash
pnpm webapp:dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

Register the first account — it becomes the workspace owner automatically.

### Useful development commands

| Command                     | Description                                     |
| --------------------------- | ----------------------------------------------- |
| `pnpm webapp:dev`           | Start development server with HMR               |
| `pnpm webapp:test -- --run` | Run unit tests once (always use `--run`)        |
| `pnpm webapp:validate`      | Lint + typecheck + test (run before committing) |
| `pnpm db:generate`          | Regenerate Prisma client after schema changes   |
| `pnpm db:prepare-migration` | Create a new migration from schema changes      |
| `pnpm db:deploy-migration`  | Apply pending migrations                        |
| `pnpm db:reset`             | Reset database — **destructive**                |
| `pnpm turbo typecheck`      | TypeScript type checking across all packages    |

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` to get started.

### Required

| Variable              | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`        | `file:./dev.db` (local SQLite) or `libsql://<db>.turso.io` |
| `SESSION_SECRET`      | Random 32-byte hex string — signs JWT access tokens        |
| `INVITE_TOKEN_SECRET` | Random 32-byte hex string — signs invite links             |

### Storage

| Variable               | Description                                       | Default         |
| ---------------------- | ------------------------------------------------- | --------------- |
| `STORAGE_DRIVER`       | `local` or `s3`                                   | `local`         |
| `UPLOAD_DIR`           | Filesystem path for uploaded files (local driver) | `/data/uploads` |
| `S3_ENDPOINT`          | S3 endpoint URL (e.g. `https://minio:9000`)       | —               |
| `S3_BUCKET`            | Bucket name                                       | —               |
| `S3_ACCESS_KEY_ID`     | Access key                                        | —               |
| `S3_SECRET_ACCESS_KEY` | Secret key                                        | —               |
| `S3_REGION`            | Region                                            | `us-east-1`     |
| `S3_PUBLIC_URL`        | Public base URL for serving files                 | —               |
| `S3_FORCE_PATH_STYLE`  | Set `true` for MinIO                              | `false`         |

### Email

| Variable                | Description                                                     |
| ----------------------- | --------------------------------------------------------------- |
| `RELAY_API_KEY`         | API key from [relay.voidvalue.com](https://relay.voidvalue.com) |
| `RELAY_SMTP_KEY`        | SMTP key from relay.voidvalue.com                               |
| `SMTP_FROM`             | From address shown in emails                                    |
| `SEND_ONBOARDING_EMAIL` | Set `true` to send welcome email on signup                      |

You can also point at any SMTP relay via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PWD`.

### Turso (optional)

To use [Turso](https://turso.tech/) instead of an embedded SQLite file:

```env
DATABASE_URL="libsql://your-db-name.turso.io"
DATABASE_AUTH_TOKEN="your-auth-token"
```

### Other options

| Variable         | Description                                    | Default                 |
| ---------------- | ---------------------------------------------- | ----------------------- |
| `SERVER_URL`     | Public base URL (used in emails and QR links)  | `http://localhost:3000` |
| `DISABLE_SIGNUP` | Prevent self-registration (invites still work) | `false`                 |
| `MAPTILER_TOKEN` | MapTiler API key for map views                 | —                       |
| `ADMIN_EMAIL`    | Receives account-deletion requests             | —                       |
| `SENTRY_DSN`     | Sentry error tracking                          | —                       |

## Tech Stack

| Layer     | Technology                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------- |
| Framework | [React Router](https://reactrouter.com/) 7 (React 19)                                             |
| Language  | [TypeScript](https://www.typescriptlang.org/) 5                                                   |
| Database  | SQLite via [libSQL](https://github.com/tursodatabase/libsql) + [Prisma](https://www.prisma.io/) 6 |
| Auth      | Custom email+password (bcryptjs + JWT)                                                            |
| Storage   | Local filesystem or S3-compatible                                                                 |
| Job queue | [node-cron](https://github.com/node-cron/node-cron) + SQLite job table                            |
| Email     | [relay.voidvalue.com](https://relay.voidvalue.com) / SMTP via Nodemailer                          |
| Styling   | [Tailwind CSS](https://tailwindcss.com/) 3 + [Radix UI](https://www.radix-ui.com/)                |
| Build     | [Vite](https://vite.dev/) 7, [Turborepo](https://turbo.build/)                                    |
| Testing   | [Vitest](https://vitest.dev/)                                                                     |

## Project Structure

```
shelf.nu/
├── apps/
│   ├── webapp/          # Main application (React Router + Hono)
│   │   ├── app/
│   │   │   ├── routes/      # File-based routing
│   │   │   ├── modules/     # Business logic (booking, asset, kit, …)
│   │   │   ├── components/  # React components
│   │   │   └── utils/       # Shared utilities
│   │   └── server/          # Hono server entry + middleware
├── packages/
│   └── database/        # Prisma schema, migrations, client (@shelf/database)
└── tooling/
    └── typescript/      # Shared TypeScript config
```

## Upstream

This fork tracks [Shelf-nu/shelf.nu](https://github.com/Shelf-nu/shelf.nu). Feature additions and bug fixes from upstream may be merged periodically, excluding anything that reintroduces Supabase, Stripe, or pg-boss dependencies.

## License

Shelf.nu is licensed under [AGPL-3.0](./LICENSE).
