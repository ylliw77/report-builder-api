# System Architecture & Developer Guidelines

## Overview
The Report Builder API decouples **report authoring (CMS)** from **report consumption (External Apps)**. Authors configure database connections, SQL queries, and Handlebars layouts once; external applications trigger PDF downloads via a standardized REST endpoint.

```text
┌──────────────────────┐         Bearer JWT          ┌──────────────────────────────┐
│  Next.js Report CMS  │ ──────────────────────────► │                              │
│ (Builder & SQL IDE)  │                             │       NestJS 12 API          │
└──────────────────────┘                             │                              │
                                                     │  ┌────────────────────────┐  │
┌──────────────────────┐          x-api-key          │  │  DatabaseService (CMS) │──┼──► Primary CMS DB (PG)
│    External Apps     │ ──────────────────────────► │  └────────────────────────┘  │
│ (ERP, Billing, etc.) │ ◄────── PDF Buffer ──────── │  ┌────────────────────────┐  │
└──────────────────────┘                             │  │ DatasourceService      │──┼──► User DBs (PG/MySQL/MSSQL)
                                                     │  └────────────────────────┘  │
                                                     │  ┌────────────────────────┐  │
                                                     │  │ ReportsService         │──┼──► Handlebars + Puppeteer
                                                     │  └────────────────────────┘  │
                                                     └──────────────────────────────┘
```

---

## Core Modules

| Module | Scope | Responsibility |
| :--- | :--- | :--- |
| **`DatabaseModule`** | `@Global` | Manages the primary Knex connection pool to the CMS database (`CMS_DATABASE_URL`). |
| **`AuthModule`** | `@Global` | Handles CMS user registration/login (JWT) and API key lifecycle (`JwtAuthGuard`, `ApiKeyGuard`). |
| **`DatasourceModule`** | Feature | CRUD for external DB connections, AES-256-GCM credential encryption, dynamic Knex pool caching, connection testing, and read-only SQL query previews. |
| **`ReportsModule`** | Feature | CRUD for report templates and the Handlebars + Puppeteer PDF rendering pipeline. |

---

## Dual-Knex Database Strategy
Knex.js serves two distinct roles in this application:
1. **Static CMS Pool (`DatabaseService`):** A single persistent pool connected to the primary CMS database for storing `users`, `api_keys`, `data_sources`, and `report_templates`.
2. **Dynamic Multi-DB Pools (`DatasourceService`):** On-demand Knex instances cached in an in-memory `Map<string, Knex>` keyed by `data_source.id`. Pools are automatically evicted and destroyed when a data source is updated, deleted, or when the NestJS application shuts down (`OnModuleDestroy`).

---

## Database Schema (CMS)
Managed via Knex migrations in `src/database/migrations/` (currently **2 migrations, 4 tables**):

1. **`init_cms_tables`**
   - **`data_sources`**: External DB connection configs (`id`, `name`, `client`, `host`, `port`, `username`, `password`, `database`, timestamps).
   - **`report_templates`**: Saved report definitions (`id`, `slug`, `name`, `html_template`, `sql_query`, `data_source_id`, timestamps).
2. **`add_auth_tables`**
   - **`users`**: CMS admin accounts (`id`, `email`, `name`, `password_hash`, timestamps).
   - **`api_keys`**: Hashed keys for external apps (`id`, `name`, `key_prefix`, `key_hash`, `created_by`, `last_used_at`, timestamps).

---

## Security Model
- **External DB Passwords:** Encrypted at rest using **AES-256-GCM** (`src/common/crypto.util.ts`) with a random 12-byte IV per record. Passwords are never returned by public API endpoints (`PUBLIC_COLUMNS` projection).
- **CMS Authentication:** Passwords hashed with `bcryptjs`; CMS management routes are protected via `JwtAuthGuard` (`Authorization: Bearer <token>`).
- **External App Authentication:** API keys (`rb_...`) are shown only once on creation and stored as **SHA-256** hashes. Verified via `ApiKeyGuard` (`x-api-key` header).
- **SQL Preview Guardrail:** `POST /datasource/:id/preview` enforces read-only `SELECT` / `WITH` queries and caps returned rows (`max: 200`, `default: 50`) to prevent accidental mutations or memory spikes.

---

## PDF Generation Pipeline (`POST /reports/:slug/pdf`)
1. **Lookup:** Fetch the template by `slug` from `report_templates`.
2. **Data Resolution:**
   - **Push Mode:** If the request body includes `data`, pass it directly to the template.
   - **Pull Mode:** If `data` is omitted and `sql_query` is configured, decrypt the linked `data_source`, execute the parameterized SQL query via `DatasourceService`, and inject `{ rows, params, generatedAt }`.
3. **Compilation:** Compile `html_template` with **Handlebars**.
4. **Rendering:** Render the compiled HTML to an A4 PDF buffer using a reused singleton **Puppeteer** browser instance (opening and closing a fresh `Page` per request to prevent memory leaks).

---

## Rules for Developers & AI Agents

Follow these strict conventions when extending this repository:

### 1. Stack & Tooling Rules
- **Package Manager:** Always use `yarn` (`yarn add`, `yarn remove`). Never commit `package-lock.json` or `pnpm-lock.yaml`.
- **Database Layer:** Use **Knex.js only**. Do **not** introduce Prisma, TypeORM, or Drizzle.
- **Linting:** Run `yarn lint` before committing. All DTOs must use `class-validator` decorators.

### 2. NestJS 12 & TypeScript (ESM) Rules
- **Relative Imports:** This project uses ESM. Always include the `.js` extension on relative TypeScript imports (e.g., `import { DatabaseService } from '../database/database.service.js';`).
- **Global Modules:** Any `@Global()` module **must** still declare `exports: [...]` for its providers, otherwise NestJS will throw `UnknownDependenciesException`.
- **Knex Raw Bindings:** Always type `db.raw()` bindings as `Knex.RawBinding[] | Knex.ValueDict`, never `unknown[]`.

### 3. API, Swagger & Auth Rules
- **Swagger Coverage:** Every new controller must have `@ApiTags(...)`, every route must have `@ApiOperation({ summary: '...' })`, and every DTO property must have `@ApiProperty()` or `@ApiPropertyOptional()` with realistic examples.
- **Explicit Auth Guards:** Never leave a new endpoint unprotected by accident:
  - CMS management routes → `@ApiBearerAuth()` + `@UseGuards(JwtAuthGuard)`
  - External app consumption routes → `@ApiSecurity('api-key')` + `@UseGuards(ApiKeyGuard)`
- **Update DTOs:** Use `PartialType` from `@nestjs/swagger` (not `@nestjs/mapped-types`) so Swagger inherits property docs automatically.

### 4. Database & Migration Rules
- **Immutable Migrations:** Never edit an already-run migration file. Always create a new migration with `npx knex migrate:make <name> -x ts`.
- **Pool Hygiene:** Whenever a `data_sources` record is updated or deleted, always call `destroyPool(id)` in `DatasourceService` so stale credentials are not reused.
- **Row Normalization:** Remember that `db.raw()` returns `result.rows` for PostgreSQL (`pg`) and `result[0]` for MySQL (`mysql2`). Always route dynamic queries through `DatasourceService.executeQuery()`.

### 5. Puppeteer Rules
- **Singleton Browser:** Never call `puppeteer.launch()` on every request. Reuse `this.browser` and open/close a fresh `page` inside a `try / finally` block.
- **Content Wait Option:** Use `page.setContent(html, { waitUntil: 'load' })` (not `networkidle0`, which is rejected by current Puppeteer TypeScript types for `setContent`).

---

## Known Gotchas
- **Knex CLI Red Warnings:** Running `npx knex migrate:latest` on Node 20.19+/22.12+ may print `Failed to load external module ts-node/register`. This is harmless—Knex falls back to Node's native TypeScript loader and runs the migration.
- **Windows Watch Mode Cache:** If NestJS throws a stale dependency error after editing a module file, stop the server, delete `dist/` (`rm -rf dist`), and restart `yarn start:dev`.

---

## Roadmap / Next Steps
1. **Next.js Frontend (`report-builder-web`):**
   - Auth pages (Login / Register) storing the Bearer JWT.
   - DataSource Manager (CRUD + Test Connection button).
   - Visual Report Builder (Monaco SQL editor + live Query Preview table + Handlebars/HTML editor + live PDF preview).
   - API Key Manager (generate & revoke `rb_...` keys).
2. **Backend Enhancements (Optional):**
   - Per-template PDF settings (`format`: A4/Letter, `landscape`: boolean, custom margins).
   - Custom Handlebars helpers (currency formatting, date formatting, math/totals).
   - Rate limiting on `POST /reports/:slug/pdf` (`@nestjs/throttler`).
