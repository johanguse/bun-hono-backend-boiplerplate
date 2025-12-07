# Backend - Bun + Hono

A modern API backend built with **Bun** runtime and **Hono** framework, migrated from FastAPI. Features authentication, organization/project management, subscriptions, and file uploads.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh) v1.3+
- **Framework**: [Hono](https://hono.dev) v4.10
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team) v0.44
- **Authentication**: [Better Auth](https://better-auth.com) + JWT + OTP
- **Validation**: [Zod](https://zod.dev) v4
- **Payments**: Stripe
- **Email**: Resend
- **Storage**: Cloudflare R2
- **Linting**: [Biome](https://biomejs.dev)
- **Monitoring**: [Sentry](https://sentry.io)
- **API Docs**: Swagger UI (OpenAPI)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.3+
- PostgreSQL database (Railway recommended)

### Installation

```bash
bun install
```

### Environment Setup

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Secret for Better Auth (min 32 chars)
- `BETTER_AUTH_URL` - URL for Better Auth (e.g., <http://localhost:3000>)
- `JWT_SECRET` - Secret for JWT signing (min 16 chars)
- `FRONTEND_URL` - Your frontend URL

Optional (for full functionality):

- `RESEND_API_KEY` - For email sending
- `RESEND_FROM_EMAIL` - From email (supports "Name <email>" format)
- `STRIPE_SECRET_KEY` - For payments
- `STRIPE_WEBHOOK_SECRET` - For Stripe webhooks
- `R2_*` - For Cloudflare R2 file storage
- `SENTRY_DSN` - For error monitoring

### Database Setup

Generate migrations:

```bash
bun run db:generate
```

Run migrations:

```bash
bun run db:migrate
```

Or push schema directly (development):

```bash
bun run db:push
```

Seed the database with test data:

```bash
bun run db:seed
```

Open Drizzle Studio to view/edit data:

```bash
bun run db:studio
```

### Test Accounts (after seeding)

| Email | Password | Role |
|-------|----------|------|
| <admin@example.com> | password123 | Admin |
| <demo@example.com> | password123 | Member |
| <member@example.com> | password123 | Member |

### Development

```bash
bun run dev
```

The server will start at `http://localhost:3000`.

API documentation available at `http://localhost:3000/docs`.

### Production

```bash
bun run start
```

## API Routes

All routes are prefixed with `/api/v1`:

### Authentication

- `POST /auth/login` - Login with email/password
- `POST /auth/register` - Register new user
- `POST /auth/logout` - Logout
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password
- `POST /auth/verify-email` - Verify email with token
- `POST /auth/otp/send` - Send OTP for passwordless login
- `POST /auth/otp/verify` - Verify OTP
- `GET/POST /auth/onboarding/*` - User onboarding flow

### Users

- `GET /users/me` - Get current user profile
- `PATCH /users/me` - Update profile
- `POST /users/profile/image` - Upload avatar
- `DELETE /users/profile/image` - Delete avatar
- `GET /users/admin/users` - List users (admin)
- `POST /users/admin/users` - Create user (admin)
- `PATCH /users/admin/users/:id` - Update user (admin)
- `DELETE /users/admin/users/:id` - Delete user (admin)

### Organizations

- `POST /organizations` - Create organization
- `GET /organizations` - List user's organizations
- `GET /organizations/:id` - Get organization
- `PATCH /organizations/:id` - Update organization
- `DELETE /organizations/:id` - Delete organization
- `POST /organizations/:id/invite` - Invite member
- `GET /organizations/:id/members` - List members
- `DELETE /organizations/:id/members/:memberId` - Remove member
- `POST /organizations/:id/logo` - Upload logo
- `DELETE /organizations/:id/logo` - Delete logo

### Projects

- `POST /projects` - Create project
- `GET /projects` - List projects (paginated)
- `GET /projects/:id` - Get project
- `PUT /projects/:id` - Update project
- `DELETE /projects/:id` - Delete project

### Subscriptions

- `GET /subscriptions/plans` - List subscription plans
- `GET /subscriptions/:orgId` - Get organization subscription
- `POST /subscriptions/checkout` - Create checkout session
- `POST /subscriptions/:orgId/portal` - Get billing portal URL
- `POST /subscriptions/:orgId/cancel` - Cancel subscription
- `GET /subscriptions/:orgId/billing-history` - Get billing history

### Uploads

- `POST /uploads/presigned-url` - Get presigned upload URL
- `POST /uploads/download-url` - Get presigned download URL
- `POST /uploads/file` - Direct file upload
- `DELETE /uploads/file` - Delete file
- `POST /uploads/avatar` - Upload user avatar
- `DELETE /uploads/avatar` - Delete user avatar

### Health

- `GET /health` - Full health check
- `GET /health/ping` - Simple ping
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

### Webhooks

- `POST /webhooks/stripe` - Stripe webhook handler

## Database Schema

- `users` - User accounts with profile data
- `organizations` - Organizations/workspaces
- `organization_members` - Organization membership
- `projects` - Projects within organizations
- `subscription_plans` - Available subscription tiers
- `customer_subscriptions` - Organization subscriptions
- `billing_history` - Payment history
- `email_tokens` - Email verification/OTP tokens
- `team_invitations` - Pending invitations
- `activity_logs` - Audit logging

## Scripts

```bash
bun run dev           # Development with watch mode
bun run start         # Production start
bun run test          # Run tests in watch mode
bun run test:run      # Run tests once
bun run test:coverage # Run tests with coverage report
bun run lint          # Lint with Biome
bun run lint:fix      # Lint and fix
bun run format        # Format with Biome
bun run format:fix    # Format and fix
bun run check         # Check lint + format
bun run check:fix     # Check and fix all
bun run typecheck     # TypeScript type checking
bun run db:generate   # Generate Drizzle migrations
bun run db:migrate    # Run migrations
bun run db:push       # Push schema to database
bun run db:studio     # Open Drizzle Studio
bun run db:seed       # Seed database with test data
```

## CI/CD

GitHub Actions workflows are included for continuous integration and deployment.

### CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main`, `master`, or `develop`:

- **Lint** - Biome linting and format checking
- **Type Check** - TypeScript type validation
- **Test** - Run tests with coverage
- **Build** - Verify build succeeds

### Deploy Workflow (`.github/workflows/deploy.yml`)

Runs on push to `main` or `master`. Supports Railway and Render deployments.

The workflow uses a `DEPLOY_TARGET` variable to determine which platform to deploy to.

#### Setting Up GitHub Variables and Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Add **Variables** (click "Variables" tab):
   - `DEPLOY_TARGET` - Set to `railway` or `render`
   - `RAILWAY_SERVICE_ID` - Your Railway service ID (only if using Railway)
4. Add **Secrets** (click "Secrets" tab):
   - `RAILWAY_TOKEN` - Your Railway project token (only if using Railway)
   - `RENDER_DEPLOY_HOOK_URL` - Your Render deploy hook URL (only if using Render)

#### Railway Deployment

1. In Railway Dashboard, go to your project → **Settings** → **Tokens**
2. Create a new **Project Token** and copy it
3. Get your **Service ID** from the service URL: `https://railway.com/project/.../service/[SERVICE_ID]`
4. In GitHub repo settings:
   - Add variable: `DEPLOY_TARGET` = `railway`
   - Add variable: `RAILWAY_SERVICE_ID` = your service ID
   - Add secret: `RAILWAY_TOKEN` = your project token

#### Render Deployment

1. In Render Dashboard, go to your service → **Settings** → **Deploy Hook**
2. Copy the deploy hook URL
3. In GitHub repo settings:
   - Add variable: `DEPLOY_TARGET` = `render`
   - Add secret: `RENDER_DEPLOY_HOOK_URL` = your deploy hook URL

## Testing

The project uses [Vitest](https://vitest.dev) for testing with colocated test files.

### Test Structure

Tests are colocated with source files in `__tests__` folders:

```
src/
├── __tests__/
│   ├── setup.ts                    # Test setup and environment mocks
│   └── app.test.ts                 # App integration tests
├── lib/__tests__/
│   ├── jwt.test.ts                 # JWT utility tests
│   └── zod.test.ts                 # Zod validation tests
└── routes/
    ├── auth/__tests__/
    │   └── schemas.test.ts         # Auth schema tests
    ├── health/__tests__/
    │   └── health.test.ts          # Health endpoint tests
    ├── organizations/__tests__/
    │   └── organizations.test.ts   # Organization tests
    ├── projects/__tests__/
    │   └── projects.test.ts        # Project tests
    ├── subscriptions/__tests__/
    │   └── subscriptions.test.ts   # Subscription tests
    ├── uploads/__tests__/
    │   └── uploads.test.ts         # Upload tests
    ├── users/__tests__/
    │   └── users.test.ts           # User tests
    └── webhooks/__tests__/
        └── webhooks.test.ts        # Webhook tests
```

### Running Tests

```bash
# Watch mode (re-runs on changes)
bun run test

# Single run
bun run test:run

# With coverage report
bun run test:coverage
```

## Deployment

### Railway

A `railway.json` configuration is included for Railway deployment using RAILPACK.

```bash
railway up
```

### Render

A `render.yaml` blueprint is included for Render deployment.

## Project Structure

```
src/
├── db/
│   ├── index.ts          # Database connection
│   ├── seed.ts           # Database seeding
│   └── schema/           # Drizzle schema definitions
├── lib/
│   ├── auth.ts           # Better Auth setup
│   ├── env.ts            # Environment validation (Zod)
│   ├── jwt.ts            # JWT utilities
│   ├── r2.ts             # Cloudflare R2 client
│   ├── resend.ts         # Email client
│   ├── sentry.ts         # Sentry initialization
│   └── stripe.ts         # Stripe client
├── middleware/
│   ├── auth.ts           # Authentication middleware
│   ├── cors.ts           # CORS configuration
│   ├── logger.ts         # Request logging
│   ├── rate-limit.ts     # Rate limiting
│   └── sentry.ts         # Sentry middleware
├── routes/
│   ├── auth/             # Authentication routes
│   ├── health/           # Health check routes
│   ├── organizations/    # Organization routes
│   ├── projects/         # Project routes
│   ├── subscriptions/    # Subscription routes
│   ├── uploads/          # File upload routes
│   ├── users/            # User routes
│   └── webhooks/         # Webhook handlers
└── index.ts              # Application entry point
```

## License

MIT
