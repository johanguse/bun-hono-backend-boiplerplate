import { z } from "zod/v4";

// User schemas
export const userSchema = z.object({
  id: z.number(),
  email: z.email(),
  name: z.string().nullable(),
  role: z.string(),
  status: z.string(),
  isActive: z.boolean(),
  isSuperuser: z.boolean(),
  isVerified: z.boolean(),
  maxTeams: z.number(),
  avatarUrl: z.string().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  jobTitle: z.string().nullable(),
  country: z.string().nullable(),
  timezone: z.string().nullable(),
  bio: z.string().nullable(),
  website: z.string().nullable(),
  onboardingCompleted: z.boolean(),
  onboardingStep: z.number(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

export const userReadSchema = userSchema.omit({});

export const userCreateSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  bio: z.string().optional(),
  website: z.string().optional(),
});

// Auth schemas
export const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z.object({
  email: z.email(),
  token: z.string(),
  password: z.string().min(8),
});

export const verifyEmailSchema = z.object({
  email: z.email(),
  token: z.string(),
});

// OTP schemas
export const otpSendSchema = z.object({
  email: z.email(),
});

export const otpVerifySchema = z.object({
  email: z.email(),
  code: z.string().length(6),
  name: z.string().optional(),
});

export const otpResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user_exists: z.boolean().optional(),
});

// Onboarding schemas
export const onboardingProfileUpdateSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  bio: z.string().optional(),
  website: z.string().optional(),
});

export const onboardingStepUpdateSchema = z.object({
  step: z.number(),
  completed: z.boolean().default(false),
});

export const onboardingCompleteSchema = z.object({
  completed: z.boolean().default(true),
});

// Session schema
export const sessionSchema = z.object({
  token: z.string(),
  expiresAt: z.string(),
});

// Auth response schema
export const authResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    emailVerified: z.boolean(),
    role: z.string(),
    is_verified: z.boolean(),
    is_superuser: z.boolean(),
    onboarding_completed: z.boolean(),
    onboarding_step: z.number(),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }),
  session: sessionSchema,
});

// Types
export type UserRead = z.infer<typeof userReadSchema>;
export type UserCreate = z.infer<typeof userCreateSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OTPSendInput = z.infer<typeof otpSendSchema>;
export type OTPVerifyInput = z.infer<typeof otpVerifySchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
