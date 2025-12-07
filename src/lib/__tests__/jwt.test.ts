import { describe, it, expect } from "vitest";
import * as jose from "jose";

describe("JWT Utilities", () => {
  const secret = new TextEncoder().encode("test-jwt-secret-key-min-32-chars");
  const algorithm = "HS256";

  describe("Token generation", () => {
    it("should create a valid JWT token", async () => {
      const payload = {
        sub: "user-123",
        email: "test@example.com",
        role: "member",
      };

      const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: algorithm })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(secret);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should include custom claims in token", async () => {
      const payload = {
        sub: "user-456",
        email: "admin@example.com",
        role: "admin",
        isSuperuser: true,
      };

      const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: algorithm })
        .setIssuedAt()
        .setExpirationTime("2h")
        .sign(secret);

      const { payload: decoded } = await jose.jwtVerify(token, secret);

      expect(decoded.sub).toBe("user-456");
      expect(decoded.email).toBe("admin@example.com");
      expect(decoded.role).toBe("admin");
      expect(decoded.isSuperuser).toBe(true);
    });
  });

  describe("Token verification", () => {
    it("should verify a valid token", async () => {
      const payload = { sub: "user-789", email: "verify@example.com" };

      const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: algorithm })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(secret);

      const { payload: decoded } = await jose.jwtVerify(token, secret);

      expect(decoded.sub).toBe("user-789");
      expect(decoded.email).toBe("verify@example.com");
    });

    it("should reject expired tokens", async () => {
      const payload = { sub: "user-expired" };

      const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: algorithm })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(secret);

      await expect(jose.jwtVerify(token, secret)).rejects.toThrow();
    });

    it("should reject tokens with invalid signature", async () => {
      const payload = { sub: "user-invalid" };
      const wrongSecret = new TextEncoder().encode("wrong-secret-key-32-characters!!");

      const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: algorithm })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(wrongSecret);

      await expect(jose.jwtVerify(token, secret)).rejects.toThrow();
    });

    it("should reject malformed tokens", async () => {
      const malformedToken = "not.a.valid.token";

      await expect(jose.jwtVerify(malformedToken, secret)).rejects.toThrow();
    });
  });

  describe("Token expiration", () => {
    it("should set correct expiration time", async () => {
      const payload = { sub: "user-exp" };
      const expiresIn = "30m";

      const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: algorithm })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secret);

      const { payload: decoded } = await jose.jwtVerify(token, secret);

      expect(decoded.exp).toBeDefined();
      const expectedExp = Math.floor(Date.now() / 1000) + 30 * 60;
      expect(decoded.exp).toBeGreaterThan(expectedExp - 5);
      expect(decoded.exp).toBeLessThan(expectedExp + 5);
    });
  });
});
