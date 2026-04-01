import { NextResponse, type NextRequest } from "next/server";
import { verifySessionJwt } from "@/lib/auth/session";

function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function withApiCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // Browser preflight must pass before auth/role checks for cross-origin mobile web calls.
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    return withApiCors(new NextResponse(null, { status: 204 }));
  }

  const token =
    extractBearerToken(request.headers.get("authorization")) ||
    request.cookies.get("sas-auth-token")?.value;
  let user = null;
  
  if (token) {
    const payload = await verifySessionJwt(token);
    if (payload) {
      user = {
        id: payload.sub,
        email: payload.email,
        user_metadata: { role: payload.app_metadata?.role },
        app_metadata: payload.app_metadata,
      };
    }
  }

  // No authenticated user
  if (!user) {
    // Allow public routes
    if (
      pathname.startsWith("/login") ||
      pathname.startsWith("/register") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/api/auth") ||
      pathname === "/"
    ) {
      return supabaseResponse;
    }
    
    // For API routes, return 401 instead of redirecting
    if (pathname.startsWith("/api/")) {
      return withApiCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }

    // Redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Get user role from JWT metadata
  const role = user.user_metadata?.role || user.app_metadata?.role || "student";

  // Role-based route protection
  const isApiRoute = pathname.startsWith("/api/");
  const isAuthApi = pathname.startsWith("/api/auth");

  if (role === "student") {
    // Prevent students from accessing teacher dashboard
    if (pathname.startsWith("/dashboard")) {
      const url = request.nextUrl.clone();
      url.pathname = "/"; 
      return NextResponse.redirect(url);
    }
    
    const studentAllowedApiRoutes = [
      "/api/students/update-password",
      "/api/students/tickets/close",
      "/api/students/tickets/list",
      "/api/students/history",
    ];

    // Prevent students from accessing teacher APIs while allowing student-safe routes.
    if (
      isApiRoute &&
      !isAuthApi &&
      !pathname.startsWith("/api/qr/scan") &&
      !studentAllowedApiRoutes.some((route) => pathname.startsWith(route))
    ) {
      return withApiCors(NextResponse.json({ error: "Forbidden: Teacher access required" }, { status: 403 }));
    }
  }

  return supabaseResponse;
}
