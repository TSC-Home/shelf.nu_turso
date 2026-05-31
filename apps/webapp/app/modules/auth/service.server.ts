/**
 * Custom Authentication Service
 *
 * Replaces the Supabase auth integration with a self-hosted solution:
 * - Passwords hashed with bcryptjs (stored in UserPassword table)
 * - Short-lived JWT access tokens (1 hour, signed with SESSION_SECRET)
 * - Long-lived refresh tokens (30 days, stored in UserSession table)
 *
 * @see {@link file://../../server/middleware.ts} - protect() and refreshSession()
 * @see {@link file://../../server/session.ts} - AuthSession cookie shape
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { AuthSession } from "@server/session";
import { db } from "~/database/db.server";
import { triggerEmail } from "~/emails/email.worker.server";
import { SERVER_URL, SESSION_SECRET } from "~/utils/env";
import type { ErrorLabel } from "~/utils/error";
import { ShelfError } from "~/utils/error";
import { Logger } from "~/utils/logger";

const label: ErrorLabel = "Auth";

/** Access token lifetime in seconds (1 hour) */
const ACCESS_TOKEN_TTL = 60 * 60;
/** Refresh token lifetime in milliseconds (30 days) */
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** bcrypt work factor */
const SALT_ROUNDS = 10;

type JwtPayload = { userId: string; email: string };

/** Signs a short-lived JWT access token. */
function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ userId, email } satisfies JwtPayload, SESSION_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

/** Verifies and decodes an access token. Returns null on failure. */
function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SESSION_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/** Generates a cryptographically random refresh token string. */
function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

/** Builds an AuthSession from a user + a freshly created UserSession row. */
function buildAuthSession(
  userId: string,
  email: string,
  refreshToken: string
): AuthSession {
  const accessToken = signAccessToken(userId, email);
  const decoded = jwt.decode(accessToken) as { exp: number };
  const expiresAt = decoded.exp;
  return {
    accessToken,
    refreshToken,
    userId,
    email,
    expiresIn: ACCESS_TOKEN_TTL,
    expiresAt,
  };
}

/** Creates a UserPassword record for a new user. */
export async function createEmailAuthAccount(email: string, password: string) {
  try {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new ShelfError({
        cause: null,
        message: "User not found — create the User record first",
        additionalData: { email },
        label,
      });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.userPassword.upsert({
      where: { userId: user.id },
      create: { userId: user.id, hash },
      update: { hash },
    });

    return { id: user.id, email: user.email };
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Failed to create email auth account",
      additionalData: { email },
      label,
    });
  }
}

/**
 * Looks up an existing user account by email and (re-)sets their password.
 * Used as a fallback during invite acceptance.
 */
export async function confirmExistingAuthAccount(
  email: string,
  password: string
) {
  try {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true },
    });

    if (!user) return null;

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.userPassword.upsert({
      where: { userId: user.id },
      create: { userId: user.id, hash },
      update: { hash },
    });

    return { id: user.id, email: user.email };
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Failed to confirm existing auth account",
      additionalData: { email },
      label,
    });
  }
}

/** Alias kept for call-site compatibility. */
export const signUpWithEmailPass = createEmailAuthAccount;

/** Signs in a user with email + password. Returns AuthSession or null if credentials are wrong. */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthSession | null> {
  try {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, password: true },
    });

    if (!user?.password) {
      return null;
    }

    const valid = await bcrypt.compare(password, user.password.hash);
    if (!valid) {
      throw new ShelfError({
        cause: null,
        message: "Incorrect email or password",
        label,
        shouldBeCaptured: false,
      });
    }

    const refreshToken = generateRefreshToken();
    await db.userSession.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return buildAuthSession(user.id, user.email, refreshToken);
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        cause instanceof ShelfError
          ? cause.message
          : "Something went wrong. Please try again later or contact support.",
      label,
      shouldBeCaptured: !(cause instanceof ShelfError),
    });
  }
}

/**
 * Sends a password-reset link via email.
 * The link contains a short-lived JWT (`purpose: 'reset'`) that the
 * `/reset-password` route verifies before allowing the password change.
 */
export async function sendResetPasswordLink(email: string) {
  try {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, firstName: true },
    });

    // Silently succeed even if the email doesn't exist to avoid user enumeration
    if (!user) return;

    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: "reset" },
      SESSION_SECRET,
      { expiresIn: "15m" }
    );

    const resetUrl = `${SERVER_URL}/reset-password?token=${resetToken}`;

    await triggerEmail({
      to: user.email,
      subject: "Reset your Shelf password",
      text: `Hi ${
        user.firstName ?? ""
      },\n\nClick the link below to reset your password. The link expires in 15 minutes.\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.\n\n— The Shelf Team`,
      html: `<p>Hi ${
        user.firstName ?? ""
      },</p><p>Click the link below to reset your password. The link expires in 15 minutes.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can ignore this email.</p><p>— The Shelf Team</p>`,
    });
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while sending the reset password link. Please try again later or contact support.",
      additionalData: { email },
      label,
    });
  }
}

/**
 * Verifies a password-reset token and returns the userId if valid.
 * Returns null if the token is expired, invalid, or has the wrong purpose.
 */
export function verifyResetToken(
  token: string
): { userId: string; email: string } | null {
  try {
    const payload = jwt.verify(token, SESSION_SECRET) as {
      userId: string;
      email: string;
      purpose: string;
    };
    if (payload.purpose !== "reset") return null;
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

/** Updates the password for a user. Optionally invalidates all other sessions. */
export async function updateAccountPassword(
  id: string,
  password: string,
  invalidateOtherSessions?: boolean
) {
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.userPassword.upsert({
      where: { userId: id },
      create: { userId: id, hash },
      update: { hash },
    });

    if (invalidateOtherSessions) {
      await db.userSession.deleteMany({ where: { userId: id } });
    }
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while updating the password. Please try again later or contact support.",
      additionalData: { id },
      label,
    });
  }
}

/** Deletes auth credentials for a user (password + all sessions). */
export async function deleteAuthAccount(userId: string) {
  try {
    await db.userPassword.deleteMany({ where: { userId } });
    await db.userSession.deleteMany({ where: { userId } });
  } catch (cause) {
    Logger.error(
      new ShelfError({
        cause,
        message: "Something went wrong while deleting the auth account.",
        additionalData: { userId },
        label,
      })
    );
  }
}

/** Looks up a user by ID. Mirrors Supabase's getAuthUserById shape. */
export async function getAuthUserById(userId: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    // Attach user_metadata shape expected by onboarding (was a Supabase field).
    // All accounts in this fork use email-password auth.
    return user
      ? { ...user, user_metadata: { signup_method: "email-password" } }
      : null;
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while getting the auth user by id. Please try again later or contact support.",
      additionalData: { userId },
      label,
    });
  }
}

/**
 * Validates that a refresh token exists and has not expired.
 * Used by the `protect()` middleware on every request.
 */
export async function validateSession(token: string): Promise<boolean> {
  try {
    const session = await db.userSession.findFirst({
      where: {
        refreshToken: token,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!session) {
      Logger.error(
        new ShelfError({
          cause: null,
          message: "Refresh token is invalid or has expired",
          label,
          shouldBeCaptured: false,
        })
      );
    }

    return session !== null;
  } catch {
    Logger.error(
      new ShelfError({
        cause: null,
        message: "Something went wrong while validating the session",
        label,
        shouldBeCaptured: false,
      })
    );
    return false;
  }
}

/**
 * Rotates the refresh token and issues a new access token.
 * Called by `refreshSession()` middleware when the access token is near expiry.
 */
export async function refreshAccessToken(
  refreshToken?: string
): Promise<AuthSession> {
  try {
    if (!refreshToken) {
      throw new ShelfError({
        cause: null,
        message: "Refresh token is required",
        label,
      });
    }

    const existing = await db.userSession.findFirst({
      where: {
        refreshToken,
        expiresAt: { gt: new Date() },
      },
      select: { userId: true, user: { select: { email: true } } },
    });

    if (!existing) {
      throw new ShelfError({
        cause: null,
        message: "Refresh token is invalid or has expired",
        label,
        shouldBeCaptured: false,
      });
    }

    // Rotate: delete old session, create new one
    const newRefreshToken = generateRefreshToken();
    await db.userSession.deleteMany({ where: { refreshToken } });
    await db.userSession.create({
      data: {
        userId: existing.userId,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return buildAuthSession(
      existing.userId,
      existing.user.email,
      newRefreshToken
    );
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Unable to refresh access token. Please try again. If the issue persists, contact support",
      label,
      additionalData: { refreshToken },
    });
  }
}

/**
 * Verifies that the access token in the session is still valid.
 * Used when a strict check is needed (e.g., password-change flows).
 */
export async function verifyAuthSession(
  authSession: AuthSession
): Promise<boolean> {
  try {
    const payload = verifyAccessToken(authSession.accessToken);
    if (!payload) return false;

    const session = await db.userSession.findFirst({
      where: {
        refreshToken: authSession.refreshToken,
        userId: authSession.userId,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    return session !== null;
  } catch (cause) {
    throw new ShelfError({
      cause,
      message:
        "Something went wrong while verifying the auth session. Please try again later or contact support.",
      label,
    });
  }
}

/**
 * Validates a JWT access token from a mobile API `Authorization: Bearer` header.
 * Returns the decoded payload or null if the token is invalid/expired.
 */
export function verifyMobileAccessToken(token: string): JwtPayload | null {
  return verifyAccessToken(token);
}
