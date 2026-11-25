# Report Builder API

A multi-database Report Builder & PDF Generation backend built with **NestJS 12**, **Knex.js**, **Handlebars**, and **Puppeteer**. Manage external database connections and HTML/SQL report templates in a CMS, then let any external application generate and download PDFs via a single API endpoint.

## Key Features
- **Multi-Database Connectivity:** Connect dynamically to PostgreSQL (`pg`), MySQL (`mysql2`), SQL Server (`tedious`), and SQLite (`better-sqlite3`) using cached Knex connection pools.
- **Dual PDF Generation Modes:**
  - **Push Mode:** External apps send JSON `data` directly to render against a saved Handlebars template.
  - **Pull Mode:** Templates run a saved parameterized SQL query against a user-selected database.
- **Live SQL Query Preview:** Test read-only `SELECT` / `WITH` queries and inspect column names and sample rows before saving a template.
- **Security Built-In:** AES-256-GCM encryption for stored database passwords, JWT auth for CMS management, and SHA-256 hashed API keys (`x-api-key`) for external apps.
- **Interactive API Docs:** Full OpenAPI/Swagger UI available at `/docs`.

## Tech Stack
- **Framework:** NestJS 12 (TypeScript, ESM, ESLint)
- **Database & Query Engine:** Knex.js (`pg`, `mysql2`, `tedious`, `better-sqlite3`)
- **PDF Engine:** Handlebars + Puppeteer
- **Auth:** JWT (CMS users) + API Keys (`x-api-key` for external apps)
- **API Docs:** Swagger / OpenAPI (`/docs`)
- **Package Manager:** Yarn

## Prerequisites
- Node.js `v20.19+` or `v22.12+`
- Yarn (`npm install -g yarn`)
- PostgreSQL (or MySQL) for the primary CMS database

## Project Structure
```text
report-builder-api/
├── knexfile.ts                  # Knex CLI configuration
├── .env                         # Environment variables
└── src/
    ├── common/
    │   └── crypto.util.ts       # AES-256-GCM encrypt/decrypt helper
    ├── database/
    │   ├── migrations/          # Knex migrations (CMS tables & auth tables)
    │   ├── database.module.ts   # Global CMS Knex module
    │   └── database.service.ts  # Primary CMS DB connection
    ├── auth/
    │   ├── dto/                 # Register, Login, API Key DTOs
    │   ├── guards/              # JwtAuthGuard & ApiKeyGuard
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   └── auth.module.ts
    ├── datasource/
    │   ├── dto/                 # DataSource & QueryPreview DTOs
    │   ├── datasource.controller.ts
    │   ├── datasource.service.ts # CRUD, test-connection, pool cache, SQL preview
    │   └── datasource.module.ts
    └── reports/
        ├── dto/                 # ReportTemplate & GeneratePdf DTOs
        ├── reports.controller.ts
        ├── reports.service.ts   # Template CRUD, Handlebars & Puppeteer PDF engine
        └── reports.module.ts
```

## Quick Start

### 1. Install Dependencies
```bash
yarn install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:

```env
PORT=4000
CMS_DATABASE_URL="postgresql://postgres:password@localhost:5432/report_cms"
ENCRYPTION_KEY="replace-with-a-32-char-secret-key"
JWT_SECRET="replace-with-a-long-random-jwt-secret"
```

| Variable | Required | Description |
| :--- | :---: | :--- |
| `PORT` | No | Port the API listens on (defaults to `4000`). |
| `CMS_DATABASE_URL` | Yes | Connection string for the primary CMS database. |
| `ENCRYPTION_KEY` | Yes | Secret used to encrypt/decrypt external DB passwords (AES-256-GCM). |
| `JWT_SECRET` | Yes | Signing secret for CMS user JWT tokens. |

### 3. Run Database Migrations
```bash
npx knex migrate:latest
```

### 4. Start the Server
```bash
yarn start:dev
```
- **API Base URL:** `http://localhost:4000`
- **Swagger UI:** `http://localhost:4000/docs`

## API Endpoints Overview

### Auth & API Keys (`/auth`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Register a new CMS user |
| `POST` | `/auth/login` | Public | Log in and receive a Bearer JWT |
| `POST` | `/auth/api-keys` | Bearer JWT | Generate a new `rb_...` API key (shown once) |
| `GET` | `/auth/api-keys` | Bearer JWT | List active API keys (prefix & last used) |
| `DELETE` | `/auth/api-keys/:id` | Bearer JWT | Revoke an API key |

### DataSources (`/datasource`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/datasource/test` | Bearer JWT | Test DB credentials before saving |
| `POST` | `/datasource` | Bearer JWT | Save a new DB connection (password encrypted) |
| `GET` | `/datasource` | Bearer JWT | List all saved DB connections |
| `GET` | `/datasource/:id` | Bearer JWT | Get a single DB connection |
| `PATCH` | `/datasource/:id` | Bearer JWT | Update a DB connection (evicts cached pool) |
| `DELETE` | `/datasource/:id` | Bearer JWT | Delete a DB connection |
| `POST` | `/datasource/:id/preview` | Bearer JWT | Run a read-only `SELECT` query and inspect columns/rows |

### Reports & PDF Generation (`/reports`)
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/reports` | Bearer JWT | Create a new report template |
| `GET` | `/reports` | Bearer JWT | List all report templates |
| `GET` | `/reports/:id` | Bearer JWT | Get a single report template |
| `PATCH` | `/reports/:id` | Bearer JWT | Update a report template |
| `DELETE` | `/reports/:id` | Bearer JWT | Delete a report template |
| `POST` | `/reports/:slug/pdf` | `x-api-key` | Generate and download a PDF |

## External App Integration Examples

### Option A: Push Mode (Send JSON Data Directly)
```bash
curl -X POST http://localhost:4000/reports/invoice-sample/pdf \
  -H "Content-Type: application/json" \
  -H "x-api-key: rb_your_generated_api_key" \
  -d '{
    "data": {
      "invoiceNo": "INV-2026-001",
      "customer": "Acme Corp",
      "items": [
        { "name": "Report License", "price": 250 }
      ]
    }
  }' \
  --output invoice-sample.pdf
```

### Option B: Pull Mode (Execute Saved SQL Query with Parameters)
```bash
curl -X POST http://localhost:4000/reports/monthly-sales/pdf \
  -H "Content-Type: application/json" \
  -H "x-api-key: rb_your_generated_api_key" \
  -d '{
    "params": {
      "status": "PAID",
      "month": "2026-11"
    }
  }' \
  --output monthly-sales.pdf
```

## Useful Commands
```bash
yarn start:dev                  # Start API in watch mode
yarn build                      # Compile TypeScript to dist/
yarn lint                       # Run ESLint
npx knex migrate:make <name> -x ts  # Create a new migration
npx knex migrate:latest         # Run pending migrations
npx knex migrate:rollback       # Roll back the last migration batch
```

## Troubleshooting
- **`Failed to load external module ts-node/register` during Knex migrations:** Safe to ignore on Node 20.19+/22.12+ (Knex falls back to Node's native TypeScript execution). Install `yarn add -D ts-node` if you prefer clean terminal output.
- **Puppeteer on Linux / Docker:** Ensure Chromium system libraries are installed or run with `--no-sandbox` (already configured in `ReportsService`).
