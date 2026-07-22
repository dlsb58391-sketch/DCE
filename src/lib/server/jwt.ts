import { SignJWT, jwtVerify } from "jose";

// Edge-safe: only depends on `jose` (no next/headers), so middleware can use it.

export const SESSION_COOKIE = "bdic_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  sub: string; // user id
  email: string;
  name: string;
  role: string;
  ver?: number; // tokenVersion at issue time; compared against User.tokenVersion to revoke
};

// Reject known-weak/placeholder secrets so a copied .env.example can never sign
// forgeable tokens in a real deployment.
const KNOWN_WEAK = new Set([
  "change-me",
  "changeme",
  "secret",
  "password",
  "test",
  "your-secret",
  "mysecret",
  "jwt-secret",
  "auth-secret",
  "12345678901234567890123456789012",
]);

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length === 0) {
    throw new Error(
      "[AUTH_SECRET] Not set. Generate one with: " +
        "node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
    );
  }
  if (s.length < 32) {
    throw new Error(`[AUTH_SECRET] Too short (${s.length} chars). Must be >= 32 characters.`);
  }
  if (KNOWN_WEAK.has(s.toLowerCase())) {
    throw new Error(
      "[AUTH_SECRET] Set to a known placeholder value. Replace it with a random secret.",
    );
  }
  return new TextEncoder().encode(s);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  // The desktop app serves over plain http://127.0.0.1, so a Secure cookie would
  // be dropped and the login would loop. DESKTOP=1 opts out of Secure locally;
  // hosted deployments (Railway) never set it, so they keep Secure in production.
  secure: process.env.NODE_ENV === "production" && process.env.DESKTOP !== "1",
  path: "/",
  maxAge: MAX_AGE,
};
