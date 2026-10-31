import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { RETURN_PATH_HEADER } from "@/lib/db/return-path";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(RETURN_PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (request.nextUrl.pathname.startsWith("/patient") && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)"],
};
