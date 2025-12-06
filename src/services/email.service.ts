import { Resend } from "resend";
import { env } from "../lib/env";

// Initialize Resend client
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const fromEmail = env.RESEND_FROM_EMAIL || "noreply@example.com";

/**
 * Send OTP email for passwordless authentication
 */
export async function sendOTPEmail(
  email: string,
  code: string,
  name?: string | null,
): Promise<boolean> {
  if (!resend) {
    console.warn(`[DEV] OTP code for ${email}: ${code}`);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Your verification code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello${name ? ` ${name}` : ""}!</h2>
          <p>Your verification code is:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code expires in 15 minutes.</p>
          <p>If you didn't request this code, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Failed to send OTP email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    return false;
  }
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
  name?: string | null,
): Promise<boolean> {
  const verifyUrl = `${
    env.FRONTEND_URL
  }/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  if (!resend) {
    console.warn(`[DEV] Verification URL for ${email}: ${verifyUrl}`);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Verify your email address",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello${name ? ` ${name}` : ""}!</h2>
          <p>Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Verify Email
            </a>
          </div>
          <p>Or copy and paste this link:</p>
          <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
          <p>This link expires in 24 hours.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Failed to send verification email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return false;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  token: string,
  name?: string | null,
): Promise<boolean> {
  const resetUrl = `${
    env.FRONTEND_URL
  }/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  if (!resend) {
    console.warn(`[DEV] Password reset URL for ${email}: ${resetUrl}`);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Reset your password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello${name ? ` ${name}` : ""}!</h2>
          <p>You requested to reset your password. Click the button below to proceed:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p>This link expires in 1 hour.</p>
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Failed to send password reset email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return false;
  }
}

/**
 * Send welcome email after registration
 */
export async function sendWelcomeEmail(email: string, name?: string | null): Promise<boolean> {
  if (!resend) {
    console.warn(`[DEV] Welcome email would be sent to ${email}`);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Welcome to our platform!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome${name ? ` ${name}` : ""}!</h2>
          <p>Thank you for joining our platform. We're excited to have you on board!</p>
          <p>Here are some things you can do to get started:</p>
          <ul>
            <li>Complete your profile</li>
            <li>Create or join an organization</li>
            <li>Start your first project</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${
              env.FRONTEND_URL
            }/dashboard" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Go to Dashboard
            </a>
          </div>
          <p>If you have any questions, feel free to reach out to our support team.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Failed to send welcome email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return false;
  }
}

/**
 * Send team invitation email
 */
export async function sendInvitationEmail(
  email: string,
  inviterName: string,
  organizationName: string,
  token: string,
  message?: string | null,
): Promise<boolean> {
  const inviteUrl = `${env.FRONTEND_URL}/invitations/accept?token=${token}`;

  if (!resend) {
    console.warn(`[DEV] Invitation URL for ${email}: ${inviteUrl}`);
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `You've been invited to join ${organizationName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You've been invited!</h2>
          <p>${inviterName} has invited you to join <strong>${organizationName}</strong>.</p>
          ${
            message
              ? `<p style="background: #f4f4f4; padding: 15px; border-radius: 6px; font-style: italic;">"${message}"</p>`
              : ""
          }
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Accept Invitation
            </a>
          </div>
          <p>Or copy and paste this link:</p>
          <p style="word-break: break-all; color: #666;">${inviteUrl}</p>
          <p>This invitation expires in 7 days.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Failed to send invitation email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send invitation email:", error);
    return false;
  }
}
