import { NextRequest, NextResponse } from "next/server";

// Keep same-origin protection for write requests, but the tracker itself is
// intentionally accessible without an application password or login cookie.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  if (pathname.startsWith("/api/") && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return NextResponse.json({ success: false, error: "Request could not be verified." }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
