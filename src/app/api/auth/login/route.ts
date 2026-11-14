import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  isAuthConfigured,
  passwordMatches,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ success: false, error: "Request could not be verified." }, { status: 403 });
  }

  if (!isAuthConfigured()) {
    return NextResponse.json(
      { success: false, error: "Tracker login has not been configured yet. Please contact the site owner." },
      { status: 503 }
    );
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Enter your password." }, { status: 400 });
  }

  if (typeof body.password !== "string" || body.password.length > 512 || !passwordMatches(body.password)) {
    return NextResponse.json({ success: false, error: "That password wasn't recognised." }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
