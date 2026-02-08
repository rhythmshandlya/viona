import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Only these routes are public (no auth required)
const publicRoutes = ["/login", "/authenticate"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check for Stytch session cookies
  const sessionToken = request.cookies.get("stytch_session")?.value;
  const sessionJwt = request.cookies.get("stytch_session_jwt")?.value;
  const isAuthenticated = !!sessionToken || !!sessionJwt;

  // Check if current path is public
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Redirect unauthenticated users to login
  if (!isPublicRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page to projects dashboard
  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
