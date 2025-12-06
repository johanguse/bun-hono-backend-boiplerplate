# Backend - Bun + Hono

A modern API backend built with **Bun** runtime and **Hono** framework, migrated from FastAPI. Features authentication, organization/project management, subscriptions, and file uploads.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Hono](https://hono.dev)
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team)
- **Authentication**: [Better Auth](https://better-auth.com) + JWT + OTP
- **Validation**: Zod
- **Payments**: Stripe
- **Email**: Resend
- **Storage**: Cloudflare R2

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0+
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
- `JWT_SECRET` - Secret for JWT signing
- `FRONTEND_URL` - Your frontend URL

Optional (for full functionality):

- `RESEND_API_KEY` - For email sending
- `STRIPE_SECRET_KEY` - For payments
- `R2_*` - For file storage

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

### Development

```bash
bun run dev
```

The server will start at `http://localhost:3000`.

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
bun run dev         # Development with watch mode
bun run start       # Production start
bun run db:generate # Generate Drizzle migrations
bun run db:migrate  # Run migrations
bun run db:push     # Push schema to database
bun run db:studio   # Open Drizzle Studio
```

## License

MIT
