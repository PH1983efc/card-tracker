import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "everton_tracker_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.TRACKER_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

export function isAuthConfigured() {
  return Boolean(
    process.env.TRACKER_PASSWORD &&
    process.env.TRACKER_PASSWORD.length >= 12 &&
    getSecret()
  );
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken() {
  const secret = getSecret();
  if (!secret) throw new Error("Tracker authentication is not configured.");
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token?: string) {
  const secret = getSecret();
  if (!secret || !token) return false;

  const [expiresAt, signature, extra] = token.split(".");
  if (!expiresAt || !signature || extra !== undefined || !/^\d+$/.test(expiresAt)) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;

  const expected = Buffer.from(sign(expiresAt, secret));
  const supplied = Buffer.from(signature);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function isAuthenticated(request: NextRequest) {
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export function passwordMatches(candidate: string) {
  const configured = process.env.TRACKER_PASSWORD;
  if (!configured || configured.length < 12) return false;
  const expected = createHmac("sha256", "everton-tracker-password-check").update(configured).digest();
  const supplied = createHmac("sha256", "everton-tracker-password-check").update(candidate).digest();
  return timingSafeEqual(expected, supplied);
}

export const SESSION_MAX_AGE = SESSION_SECONDS;
