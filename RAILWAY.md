# Railway Deployment

Deploy this backend API to Railway with a single click.

## One-Click Deploy

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/YOUR_TEMPLATE_ID?referralCode=YOUR_CODE)

## Manual Setup

### 1. Create New Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init
```

### 2. Add PostgreSQL Database

```bash
# Add Postgres service
railway add --database postgres
```

### 3. Link and Deploy

```bash
# Link to your service
railway link

# Deploy
railway up
```

### 4. Set Environment Variables

In the Railway dashboard, add these variables:

#### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Auto-set when you add Postgres |
| `BETTER_AUTH_SECRET` | Min 32 chars - use `${{secret(64)}}` |
| `BETTER_AUTH_URL` | Your Railway public URL |
| `JWT_SECRET` | Min 16 chars - use `${{secret(32)}}` |
| `FRONTEND_URL` | Your frontend URL |

#### Optional - Email (Resend)

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | Sender email address |

#### Optional - Payments (Stripe)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `STRIPE_PUBLIC_KEY` | Stripe publishable key |

#### Optional - Storage (Cloudflare R2)

| Variable | Description |
|----------|-------------|
| `R2_ENDPOINT_URL` | R2 endpoint URL |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_URL` | R2 public URL |

#### Optional - OAuth

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret |

#### Optional - Monitoring (Sentry)

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Sentry DSN for error tracking |

## Template Variable Functions

Railway supports these functions for auto-generating values:

```
${{secret(64)}}           # 64-char random string
${{secret(32, "hex")}}    # 32-char hex string
${{randomInt(1000,9999)}} # Random 4-digit number
${{POSTGRES_URL}}         # Reference another service variable
```

## Project Structure

```
├── railway.json          # Railway config as code
├── src/
│   ├── index.ts          # Main entry point
│   ├── db/               # Drizzle ORM schema
│   ├── routes/           # API routes
│   ├── middleware/       # Auth, rate-limit, etc.
│   ├── services/         # Email, Stripe, Storage
│   └── lib/              # Utilities
```

## Health Check

The API exposes health endpoints:

- `GET /health` - Full health check with DB status
- `GET /health/ping` - Simple ping
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
