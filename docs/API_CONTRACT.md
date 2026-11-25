# API Contract — Report Builder API

- **Base URL (Local):** `http://localhost:4000`
- **Content-Type:** `application/json` (except PDF download response: `application/pdf`)
- **Swagger UI:** `GET /docs`

---

## Authentication

| Type | Header | Used By |
| :--- | :--- | :--- |
| **Bearer JWT** | `Authorization: Bearer <access_token>` | CMS Frontend (Auth, DataSources, Reports CRUD) |
| **API Key** | `x-api-key: rb_<key>` | External Apps (`POST /reports/:slug/pdf`) |

---

## Standard Error Format
All `4xx` / `5xx` errors follow the standard NestJS JSON shape:

```json
{
  "statusCode": 400,
  "message": "SQL Error: relation \"orders\" does not exist",
  "error": "Bad Request"
}
```
*(Validation errors return `message` as an array of strings.)*

---

## 1. Auth & API Keys (`/auth`)

### `POST /auth/register`
- **Auth:** Public
- **Request Body:**
```json
{
  "email": "admin@example.com",
  "name": "Admin User",
  "password": "StrongPass123!"
}
```
- **Response (`201 Created`):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@example.com",
  "name": "Admin User",
  "created_at": "2026-11-24T06:00:00.000Z"
}
```
- **Errors:** `409 Conflict` (email already registered), `400 Bad Request` (validation).

---

### `POST /auth/login`
- **Auth:** Public
- **Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "StrongPass123!"
}
```
- **Response (`201 Created`):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@example.com",
    "name": "Admin User"
  }
}
```
- **Errors:** `401 Unauthorized` (invalid credentials).

---

### `POST /auth/api-keys`
- **Auth:** Bearer JWT
- **Request Body:**
```json
{
  "name": "Billing App Production"
}
```
- **Response (`201 Created`):**
*(Note: `api_key` is returned **once** on creation and cannot be retrieved later.)*
```json
{
  "id": "a1b2c3d4-...",
  "name": "Billing App Production",
  "key_prefix": "rb_9f8e7d6",
  "created_at": "2026-11-24T06:10:00.000Z",
  "api_key": "rb_9f8e7d6c5b4a3210..."
}
```

---

### `GET /auth/api-keys`
- **Auth:** Bearer JWT
- **Response (`200 OK`):**
```json
[
  {
    "id": "a1b2c3d4-...",
    "name": "Billing App Production",
    "key_prefix": "rb_9f8e7d6",
    "last_used_at": "2026-11-24T06:15:00.000Z",
    "created_at": "2026-11-24T06:10:00.000Z"
  }
]
```

---

### `DELETE /auth/api-keys/:id`
- **Auth:** Bearer JWT
- **Response (`200 OK`):**
```json
{
  "deleted": true,
  "id": "a1b2c3d4-..."
}
```

---

## 2. DataSources (`/datasource`)
*All `/datasource` endpoints require **Bearer JWT**.*
*Supported `client` values: `"pg" | "mysql2" | "mssql" | "better-sqlite3"`.*

### `POST /datasource/test`
Tests credentials without saving them to the database.
- **Request Body:**
```json
{
  "name": "ERP Production DB",
  "client": "pg",
  "host": "localhost",
  "port": 5432,
  "username": "postgres",
  "password": "secret-password",
  "database": "erp_db"
}
```
- **Response (`201 Created`):**
```json
{
  "ok": true,
  "message": "Connection successful"
}
```
- **Errors:** `400 Bad Request` (`Connection failed: <reason>`).

---

### `POST /datasource`
Saves a new database connection (password is encrypted with AES-256-GCM and never returned).
- **Request Body:** Same as `POST /datasource/test`.
- **Response (`201 Created`):**
```json
{
  "id": "11111111-2222-3333-4444-555555555555",
  "name": "ERP Production DB",
  "client": "pg",
  "host": "localhost",
  "port": 5432,
  "username": "postgres",
  "database": "erp_db",
  "created_at": "2026-11-24T06:20:00.000Z",
  "updated_at": "2026-11-24T06:20:00.000Z"
}
```

---

### `GET /datasource`
- **Response (`200 OK`):** Array of DataSource objects (without `password`).

---

### `GET /datasource/:id`
- **Response (`200 OK`):** Single DataSource object (without `password`).
- **Errors:** `404 Not Found`.

---

### `PATCH /datasource/:id`
Updates any subset of DataSource fields and evicts the cached Knex pool.
- **Request Body:** Partial of `POST /datasource` (all fields optional).
- **Response (`200 OK`):** Updated DataSource object (without `password`).

---

### `DELETE /datasource/:id`
Destroys any active Knex pool and deletes the record.
- **Response (`200 OK`):**
```json
{
  "deleted": true,
  "id": "11111111-2222-3333-4444-555555555555"
}
```

---

### `POST /datasource/:id/preview`
Executes a read-only `SELECT` or `WITH` query against the specified DataSource and returns columns + sample rows.
- **Request Body:**
```json
{
  "sql": "SELECT id, name, client FROM data_sources WHERE client = :client",
  "params": {
    "client": "pg"
  },
  "limit": 50
}
```
*(Fields `params` and `limit` are optional; `limit` defaults to `50`, max `200`.)*
- **Response (`201 Created`):**
```json
{
  "columns": ["id", "name", "client"],
  "rows": [
    {
      "id": "11111111-2222-3333-4444-555555555555",
      "name": "ERP Production DB",
      "client": "pg"
    }
  ],
  "totalReturned": 1,
  "truncated": false,
  "durationMs": 14
}
```
- **Errors:** `400 Bad Request` (non-SELECT query or SQL syntax error), `404 Not Found`.

---

## 3. Reports & PDF Generation (`/reports`)

### `POST /reports`
- **Auth:** Bearer JWT
- **Request Body:**
```json
{
  "slug": "invoice-sample",
  "name": "Sample Invoice",
  "html_template": "<html><body><h1>Invoice #{{invoiceNo}}</h1></body></html>",
  "sql_query": "SELECT * FROM invoices WHERE id = :id",
  "data_source_id": "11111111-2222-3333-4444-555555555555"
}
```
*(`slug` must match `/^[a-z0-9-]+$/`. `sql_query` and `data_source_id` are optional.)*
- **Response (`201 Created`):**
```json
{
  "id": "99999999-8888-7777-6666-555555555555",
  "slug": "invoice-sample",
  "name": "Sample Invoice",
  "html_template": "<html><body><h1>Invoice #{{invoiceNo}}</h1></body></html>",
  "sql_query": "SELECT * FROM invoices WHERE id = :id",
  "data_source_id": "11111111-2222-3333-4444-555555555555",
  "created_at": "2026-11-24T06:30:00.000Z",
  "updated_at": "2026-11-24T06:30:00.000Z"
}
```
- **Errors:** `409 Conflict` (duplicate `slug`).

---

### `GET /reports`
- **Auth:** Bearer JWT
- **Response (`200 OK`):** Array of ReportTemplate objects ordered by `updated_at DESC`.

---

### `GET /reports/:id`
- **Auth:** Bearer JWT
- **Response (`200 OK`):** Single ReportTemplate object.
- **Errors:** `404 Not Found`.

---

### `PATCH /reports/:id`
- **Auth:** Bearer JWT
- **Request Body:** Partial of `POST /reports` (all fields optional).
- **Response (`200 OK`):** Updated ReportTemplate object.

---

### `DELETE /reports/:id`
- **Auth:** Bearer JWT
- **Response (`200 OK`):**
```json
{
  "deleted": true,
  "id": "99999999-8888-7777-6666-555555555555"
}
```

---

### `POST /reports/:slug/pdf`
Generates and downloads a PDF for the given template `slug`.
- **Auth:** `x-api-key: rb_<key>`
- **Request Body (Option A — Push Mode):**
```json
{
  "data": {
    "invoiceNo": "INV-2026-001",
    "customer": "Acme Corp",
    "items": [
      { "name": "Report License", "price": 250 }
    ]
  }
}
```
- **Request Body (Option B — Pull Mode / SQL-driven):**
*(Template receives `{ rows, params, generatedAt }` in Handlebars context.)*
```json
{
  "params": {
    "id": 1001
  }
}
```
- **Response (`201 Created`):**
  - **Headers:**
    - `Content-Type: application/pdf`
    - `Content-Disposition: attachment; filename="<slug>.pdf"`
    - `Content-Length: <bytes>`
  - **Body:** Raw PDF binary stream.
- **Errors:** `401 Unauthorized` (missing/invalid `x-api-key`), `404 Not Found` (unknown `slug`), `400 Bad Request` (SQL query configured without `data_source_id`).
