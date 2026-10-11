# Beauty Salon Appointment Booking System — Backend

A robust, production-minded NestJS REST API backend for a daily appointment booking system, powered by TypeScript, Prisma 7, and hosted PostgreSQL on Neon.

---

## 1. Architecture & Design Principles

### Core Concepts
- **Framework:** NestJS 12 (TypeScript, CommonJS build output).
- **Database:** Hosted PostgreSQL on Neon.
- **ORM:** Prisma 7.10.0 with `@prisma/adapter-pg` driver adapter.
- **Dependency Injection:** Every service (`PrismaService`, `AuthService`, `AppointmentsService`) is decoupled and injected via standard NestJS modules (`PrismaModule`, `AuthModule`, `AppointmentsModule`).
- **Calendar Date-Only Semantics:**
  - Customers book a whole day (not time slots).
  - Dates are stored as native PostgreSQL `DATE` columns (e.g. `2026-10-15`).
  - Dates are parsed strictly and formatted using UTC boundaries, preventing timezone shifts from altering calendar dates.
- **PostgreSQL Partial Unique Constraint:**
  - Only **one** confirmed appointment is allowed per calendar date.
  - Enforced directly at the database level via a partial unique index:
    ```sql
    CREATE UNIQUE INDEX "appointments_date_confirmed_unique"
    ON "appointments"("date")
    WHERE "status" = 'CONFIRMED';
    ```
  - Cancelled appointments retain historical records without occupying the date constraint, immediately freeing the date for new bookings.
  - Concurrent requests racing to book the same date are rejected by PostgreSQL with unique constraint violations, translated cleanly into `HTTP 409 Conflict`.
- **Security & Privacy:**
  - Public availability endpoint (`GET /appointments/availability?month=YYYY-MM`) returns only dates and boolean flags; customer information is strictly withheld.
  - Admin authentication uses secure password hashing (`bcryptjs`, 12 rounds) and signed HTTP-only cookies (`admin_token`).
  - Centralized global validation pipe with payload whitelisting and rejection of non-whitelisted properties.
  - In-memory rate limiting protects public booking (15 req/min) and admin login attempts (5 req/min).

---

## 2. Prerequisites

- **Node.js:** `v22.x` (verified on `22.23.3`)
- **npm:** `v10.x` or later
- **PostgreSQL:** Neon database branch

---

## 3. Installation & Setup

1. **Clone & Install Dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration:**
   Copy `.env.example` to `.env.local` (or `.env`):
   ```bash
   cp .env.example .env.local
   ```
   Configure your environment variables:
   - `DATABASE_URL`: Connection string from your Neon development branch.
   - `JWT_SECRET`: A secure random string for signing admin tokens.
   - `FRONTEND_URL`: Allowed CORS origin (e.g. `http://localhost:3000`).
   - `PORT`: Server port (default: `3001`).

3. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

4. **Apply Database Migrations:**
   ```bash
   npx prisma migrate dev
   ```
   *(For CI/CD or production environments, use `npx prisma migrate deploy`)*

---

## 4. Administrator Provisioning

The system has no public registration route. To provision or update the administrator account safely without exposing passwords:

```bash
npm run admin:provision
```
- Prompts interactively for email and password (password input is masked/hidden).
- Alternatively, supply environment variables or arguments:
  ```bash
  ADMIN_EMAIL="admin@beautysalon.com" ADMIN_PASSWORD="SecurePassword123!" npm run admin:provision
  ```
- Uses bcrypt with 12 salt rounds and safely upserts without creating duplicate records.

---

## 5. Running the Application

- **Development Mode (with hot-reload):**
  ```bash
  npm run start:dev
  ```
- **Production Build & Run:**
  ```bash
  npm run build
  npm run start:prod
  ```
- **Linting:**
  ```bash
  npm run lint
  ```

---

## 6. Automated Testing

Run the test suites:
- **Unit Tests (32 tests covering date logic, booking conflicts, concurrency, and auth):**
  ```bash
  npm test
  ```
- **Integration & E2E Tests (14 tests against live API routes and validation):**
  ```bash
  npm run test:e2e
  ```

---

## 7. API Reference

### Public Endpoints

#### 1. Check Monthly Availability
```http
GET /appointments/availability?month=YYYY-MM
```
**Response (200 OK):**
```json
{
  "month": "2026-10",
  "days": [
    { "date": "2026-10-01", "available": true },
    { "date": "2026-10-02", "available": false }
  ]
}
```

#### 2. Create Guest Appointment
```http
POST /appointments
Content-Type: application/json

{
  "customerName": "Alice Smith",
  "email": "alice@example.com",
  "phone": "+1 (555) 123-4567",
  "date": "2026-10-15"
}
```
**Response (201 Created):**
```json
{
  "id": "c83f6b40-84a1-4209-baef-12a884c5ef33",
  "customerName": "Alice Smith",
  "email": "alice@example.com",
  "date": "2026-10-15",
  "status": "CONFIRMED",
  "createdAt": "2026-10-10T14:00:00.000Z"
}
```
**Conflict Response (409 Conflict):**
```json
{
  "statusCode": 409,
  "timestamp": "2026-10-10T14:05:00.000Z",
  "path": "/appointments",
  "message": "The date 2026-10-15 is already booked. Please choose another date."
}
```

---

### Admin-Only Endpoints
*(Requires `admin_token` HTTP-only cookie or `Authorization: Bearer <token>` header)*

#### 1. Administrator Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@beautysalon.com",
  "password": "SecurePassword123!"
}
```
**Response (200 OK):**
- Sets `admin_token` as an `HttpOnly`, `SameSite=Lax` (or `Strict` in production) cookie.
- Returns:
  ```json
  {
    "message": "Logged in successfully.",
    "admin": {
      "id": "99999999-9999-9999-9999-999999999999",
      "email": "admin@beautysalon.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

#### 2. Administrator Logout
```http
POST /auth/logout
```
**Response (200 OK):** Clears the session cookie.

#### 3. View Current Admin Profile
```http
GET /auth/me
```
**Response (200 OK):**
```json
{
  "id": "99999999-9999-9999-9999-999999999999",
  "email": "admin@beautysalon.com",
  "createdAt": "2026-10-10T12:00:00.000Z"
}
```

#### 4. List Monthly Appointments (with customer details)
```http
GET /appointments?month=YYYY-MM
```
**Response (200 OK):**
```json
[
  {
    "id": "c83f6b40-84a1-4209-baef-12a884c5ef33",
    "customerName": "Alice Smith",
    "email": "alice@example.com",
    "phone": "+1 (555) 123-4567",
    "date": "2026-10-15",
    "status": "CONFIRMED",
    "createdAt": "2026-10-10T14:00:00.000Z",
    "updatedAt": "2026-10-10T14:00:00.000Z"
  }
]
```

#### 5. View Single Appointment
```http
GET /appointments/:id
```

#### 6. Cancel Appointment (Frees Date)
```http
PATCH /appointments/:id/cancel
```
**Response (200 OK):**
```json
{
  "message": "Appointment successfully cancelled. The date is now available for new bookings.",
  "appointment": {
    "id": "c83f6b40-84a1-4209-baef-12a884c5ef33",
    "customerName": "Alice Smith",
    "email": "alice@example.com",
    "phone": "+1 (555) 123-4567",
    "date": "2026-10-15",
    "status": "CANCELLED",
    "updatedAt": "2026-10-10T14:10:00.000Z"
  }
}
```

---

## 8. Connecting the Future Next.js Frontend

1. **Credentials & Cookies:**
   - In your Next.js client (`fetch` or `axios`), always set `credentials: 'include'` (or `withCredentials: true`) when making requests to `/auth/login`, `/auth/logout`, and `/appointments` management routes.
2. **CORS:**
   - Ensure `FRONTEND_URL` in the backend's `.env.local` matches the Next.js development server URL (`http://localhost:3000`).
3. **Public Booking Form:**
   - The landing page can freely call `GET /appointments/availability?month=YYYY-MM` to render the calendar. Dates where `available === false` should be disabled in the datepicker.
   - Submitting the form calls `POST /appointments`. Catch `409 Conflict` to alert the user that someone just booked that day.
4. **Admin Dashboard:**
   - Protected dashboard pages call `GET /auth/me` on mount or inside a Next.js middleware. If unauthenticated (`401`), redirect to `/admin/login`.
