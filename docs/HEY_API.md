# HEY API Integration - Backend Bun Hono

This backend exposes an OpenAPI 3.1 specification that can be used with [Hey API](https://heyapi.dev/) to generate type-safe TypeScript SDK clients.

## OpenAPI Endpoints

The API exposes the following documentation endpoints:

- **OpenAPI JSON**: `GET /openapi.json` - Returns the full OpenAPI 3.1 specification
- **Swagger UI**: `GET /docs` - Interactive API documentation

## Using with Frontend Hey API

### Generate SDK from this Backend

In your frontend project, configure `openapi-ts.config.ts` to point to this backend:

```typescript
import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  // Point to this backend's OpenAPI endpoint
  input: 'http://localhost:3000/openapi.json',
  output: {
    path: 'src/client',
    format: 'biome',
    lint: 'biome',
  },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/sdk',
    {
      name: '@hey-api/client-axios',
      runtimeConfigPath: '../hey-api',
    },
  ],
})
```

Then run:

```bash
# Generate TypeScript SDK
bun run gen:api

# Or with watch mode
bun run gen:api:watch
```

## Operation IDs

All endpoints have clean `operationId` values that generate intuitive SDK method names:

| HTTP Method | Path | Operation ID | SDK Method |
|-------------|------|--------------|------------|
| GET | `/health` | `healthCheck` | `healthCheck()` |
| POST | `/auth/jwt/login` | `authJwtLogin` | `authJwtLogin()` |
| POST | `/auth/register` | `authRegister` | `authRegister()` |
| POST | `/auth/otp/send` | `authOtpSend` | `authOtpSend()` |
| POST | `/auth/otp/verify` | `authOtpVerify` | `authOtpVerify()` |
| POST | `/auth/forgot-password` | `authForgotPassword` | `authForgotPassword()` |
| POST | `/auth/reset-password` | `authResetPassword` | `authResetPassword()` |
| GET | `/users/me` | `usersGetMe` | `usersGetMe()` |
| PATCH | `/users/me` | `usersUpdateMe` | `usersUpdateMe()` |
| GET | `/organizations` | `organizationsList` | `organizationsList()` |
| POST | `/organizations` | `organizationsCreate` | `organizationsCreate()` |
| GET | `/organizations/{id}` | `organizationsGetById` | `organizationsGetById()` |
| PATCH | `/organizations/{id}` | `organizationsUpdateById` | `organizationsUpdateById()` |
| DELETE | `/organizations/{id}` | `organizationsDeleteById` | `organizationsDeleteById()` |
| GET | `/projects` | `projectsList` | `projectsList()` |
| POST | `/projects` | `projectsCreate` | `projectsCreate()` |
| GET | `/subscriptions` | `subscriptionsGet` | `subscriptionsGet()` |
| GET | `/subscriptions/plans` | `subscriptionsPlansList` | `subscriptionsPlansList()` |
| POST | `/uploads/presigned-url` | `uploadsGetPresignedUrl` | `uploadsGetPresignedUrl()` |
| POST | `/uploads/file` | `uploadsFile` | `uploadsFile()` |

## Usage Example

After generating the SDK in your frontend:

```typescript
import { authJwtLogin, usersGetMe, organizationsList } from '@/client/sdk.gen';
import { client } from '@/client/client.gen';
import { setupClientInterceptors } from '@/hey-api';

// Setup interceptors for auth error handling (do this once at app startup)
setupClientInterceptors(client);

// Login
const { data, error } = await authJwtLogin({
  body: {
    email: 'user@example.com',
    password: 'password123',
  },
});

// Get current user (fully typed!)
const user = await usersGetMe();

// List organizations
const orgs = await organizationsList();
```

## Adding New Endpoints

When adding new endpoints to the OpenAPI spec in `src/lib/openapi.ts`:

1. Add an `operationId` that follows the naming convention:
   - `{resource}{Action}` for simple actions (e.g., `healthCheck`, `authRegister`)
   - `{resource}List` for listing resources
   - `{resource}Create` for creating resources
   - `{resource}GetById` for getting by ID
   - `{resource}UpdateById` for updating by ID
   - `{resource}DeleteById` for deleting by ID

2. Include proper request/response schemas using `$ref` to component schemas

3. Regenerate the SDK in the frontend after changes

## Resources

- [Hey API Documentation](https://heyapi.dev/)
- [Hey API Axios Client](https://heyapi.dev/openapi-ts/clients/axios)
- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
