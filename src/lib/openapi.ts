/**
 * OpenAPI 3.1 specification for the API
 */
export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Backend API",
    description: "RESTful API built with Bun + Hono",
    version: "1.0.0",
    contact: {
      name: "API Support",
    },
    license: {
      name: "MIT",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "API v1",
    },
  ],
  tags: [
    { name: "Health", description: "Health check endpoints" },
    { name: "Auth", description: "Authentication endpoints" },
    { name: "Users", description: "User management" },
    { name: "Organizations", description: "Organization management" },
    { name: "Projects", description: "Project management" },
    { name: "Subscriptions", description: "Subscription and billing" },
    { name: "Uploads", description: "File upload management" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Returns the health status of the API",
        responses: {
          "200": {
            description: "API is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "healthy" },
                    timestamp: { type: "string", format: "date-time" },
                    version: { type: "string", example: "1.0.0" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/auth/jwt/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        description: "Authenticate user and receive JWT tokens",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TokenResponse" },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        description: "Create a new user account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string", minLength: 1 },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "User registered successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          "400": {
            description: "Invalid input or email already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/auth/otp/send": {
      post: {
        tags: ["Auth"],
        summary: "Send OTP code",
        description: "Send a one-time password to user's email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "OTP sent successfully",
          },
          "429": {
            description: "Too many requests",
          },
        },
      },
    },
    "/auth/otp/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verify OTP code",
        description: "Verify OTP and receive JWT tokens",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "code"],
                properties: {
                  email: { type: "string", format: "email" },
                  code: { type: "string", minLength: 6, maxLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "OTP verified successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TokenResponse" },
              },
            },
          },
          "401": {
            description: "Invalid or expired OTP",
          },
        },
      },
    },
    "/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request password reset",
        description: "Send password reset email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Reset email sent if account exists",
          },
        },
      },
    },
    "/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password",
        description: "Reset password using token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "password"],
                properties: {
                  token: { type: "string" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Password reset successful",
          },
          "400": {
            description: "Invalid or expired token",
          },
        },
      },
    },
    "/users/me": {
      get: {
        tags: ["Users"],
        summary: "Get current user",
        description: "Get the authenticated user's profile",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "User profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
          },
        },
      },
      patch: {
        tags: ["Users"],
        summary: "Update current user",
        description: "Update the authenticated user's profile",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  phone: { type: "string" },
                  language: { type: "string" },
                  timezone: { type: "string" },
                  theme: { type: "string", enum: ["light", "dark", "system"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated user profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
        },
      },
    },
    "/organizations": {
      get: {
        tags: ["Organizations"],
        summary: "List organizations",
        description: "Get all organizations for the current user",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "size", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: {
          "200": {
            description: "List of organizations",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaginatedOrganizations" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Organizations"],
        summary: "Create organization",
        description: "Create a new organization",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "slug"],
                properties: {
                  name: { type: "string" },
                  slug: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Organization created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Organization" },
              },
            },
          },
        },
      },
    },
    "/organizations/{id}": {
      get: {
        tags: ["Organizations"],
        summary: "Get organization",
        description: "Get organization by ID",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          "200": {
            description: "Organization details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Organization" },
              },
            },
          },
          "404": {
            description: "Organization not found",
          },
        },
      },
      patch: {
        tags: ["Organizations"],
        summary: "Update organization",
        description: "Update organization details",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated organization",
          },
        },
      },
      delete: {
        tags: ["Organizations"],
        summary: "Delete organization",
        description: "Delete an organization",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          "200": {
            description: "Organization deleted",
          },
        },
      },
    },
    "/projects": {
      get: {
        tags: ["Projects"],
        summary: "List projects",
        description: "Get all projects for the current user",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "size", in: "query", schema: { type: "integer", default: 20 } },
          { name: "organization_id", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: "List of projects",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaginatedProjects" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Projects"],
        summary: "Create project",
        description: "Create a new project",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "organization_id"],
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  organization_id: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Project created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Project" },
              },
            },
          },
        },
      },
    },
    "/subscriptions": {
      get: {
        tags: ["Subscriptions"],
        summary: "Get subscription",
        description: "Get the current user's subscription",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Subscription details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Subscription" },
              },
            },
          },
        },
      },
    },
    "/subscriptions/plans": {
      get: {
        tags: ["Subscriptions"],
        summary: "List plans",
        description: "Get all available subscription plans",
        responses: {
          "200": {
            description: "List of plans",
          },
        },
      },
    },
    "/uploads/presigned-url": {
      post: {
        tags: ["Uploads"],
        summary: "Get presigned upload URL",
        description: "Get a presigned URL for uploading a file",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["filename", "contentType"],
                properties: {
                  filename: { type: "string" },
                  contentType: { type: "string" },
                  folder: {
                    type: "string",
                    enum: ["avatars", "logos", "attachments", "documents"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Presigned URL",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    upload_url: { type: "string" },
                    key: { type: "string" },
                    public_url: { type: "string" },
                    expires_in: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/uploads/file": {
      post: {
        tags: ["Uploads"],
        summary: "Upload file",
        description: "Upload a file directly",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary" },
                  folder: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "File uploaded",
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          detail: { type: "string" },
        },
      },
      TokenResponse: {
        type: "object",
        properties: {
          access_token: { type: "string" },
          refresh_token: { type: "string" },
          token_type: { type: "string", example: "bearer" },
          expires_in: { type: "integer", example: 3600 },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "integer" },
          email: { type: "string", format: "email" },
          name: { type: "string" },
          avatar_url: { type: "string" },
          is_active: { type: "boolean" },
          is_verified: { type: "boolean" },
          language: { type: "string" },
          timezone: { type: "string" },
          theme: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Organization: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          slug: { type: "string" },
          description: { type: "string" },
          logo_url: { type: "string" },
          owner_id: { type: "integer" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      PaginatedOrganizations: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Organization" },
          },
          total: { type: "integer" },
          page: { type: "integer" },
          size: { type: "integer" },
          pages: { type: "integer" },
        },
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          description: { type: "string" },
          organization_id: { type: "integer" },
          status: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      PaginatedProjects: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Project" },
          },
          total: { type: "integer" },
          page: { type: "integer" },
          size: { type: "integer" },
          pages: { type: "integer" },
        },
      },
      Subscription: {
        type: "object",
        properties: {
          id: { type: "integer" },
          plan_id: { type: "integer" },
          status: { type: "string" },
          current_period_start: { type: "string", format: "date-time" },
          current_period_end: { type: "string", format: "date-time" },
        },
      },
    },
  },
};
