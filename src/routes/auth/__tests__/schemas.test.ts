import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  userCreateSchema,
  userUpdateSchema,
  otpSendSchema,
  otpVerifySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../schemas";

describe("Auth Schemas", () => {
  describe("loginSchema", () => {
    it("should validate correct login data", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = loginSchema.safeParse({
        email: "invalid-email",
        password: "password123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing password", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("registerSchema", () => {
    it("should validate correct registration data", () => {
      const result = registerSchema.safeParse({
        email: "newuser@example.com",
        password: "securepassword123",
        name: "Test User",
      });
      expect(result.success).toBe(true);
    });

    it("should reject password less than 8 characters", () => {
      const result = registerSchema.safeParse({
        email: "test@example.com",
        password: "short",
      });
      expect(result.success).toBe(false);
    });

    it("should allow optional name", () => {
      const result = registerSchema.safeParse({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("userCreateSchema", () => {
    it("should validate correct user creation data", () => {
      const result = userCreateSchema.safeParse({
        email: "admin@example.com",
        password: "adminpassword",
        name: "Admin User",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("userUpdateSchema", () => {
    it("should validate partial update data", () => {
      const result = userUpdateSchema.safeParse({
        name: "Updated Name",
        company: "New Company",
      });
      expect(result.success).toBe(true);
    });

    it("should allow empty update", () => {
      const result = userUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("otpSendSchema", () => {
    it("should validate email for OTP", () => {
      const result = otpSendSchema.safeParse({
        email: "otp@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = otpSendSchema.safeParse({
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("otpVerifySchema", () => {
    it("should validate correct OTP verification data", () => {
      const result = otpVerifySchema.safeParse({
        email: "test@example.com",
        code: "123456",
      });
      expect(result.success).toBe(true);
    });

    it("should reject OTP code with wrong length", () => {
      const result = otpVerifySchema.safeParse({
        email: "test@example.com",
        code: "12345", // 5 characters instead of 6
      });
      expect(result.success).toBe(false);
    });
  });

  describe("forgotPasswordSchema", () => {
    it("should validate email for password reset", () => {
      const result = forgotPasswordSchema.safeParse({
        email: "forgot@example.com",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("resetPasswordSchema", () => {
    it("should validate password reset data", () => {
      const result = resetPasswordSchema.safeParse({
        email: "reset@example.com",
        token: "some-reset-token",
        password: "newpassword123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject short password", () => {
      const result = resetPasswordSchema.safeParse({
        email: "reset@example.com",
        token: "some-reset-token",
        password: "short",
      });
      expect(result.success).toBe(false);
    });
  });
});
