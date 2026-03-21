import { NextResponse, type NextRequest } from "next/server";
import { verifySessionJwt } from "@/lib/auth/session";

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const token = request.cookies.get("sas-auth-token")?.value;
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

  const pathname = request.nextUrl.pathname;

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    
    // Prevent students from accessing teacher APIs
    if (isApiRoute && !isAuthApi && !pathname.startsWith("/api/qr/scan")) {
      return NextResponse.json({ error: "Forbidden: Teacher access required" }, { status: 403 });
    }
  }

  return supabaseResponse;
}
