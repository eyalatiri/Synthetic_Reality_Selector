import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { HOME_BY_ROLE, type UserRole } from "@/lib/auth/roles";

/**
 * Single choke point for access control (Next.js 16 renamed `middleware.ts`
 * to `proxy.ts`).
 *
 *   /  (sign-in), /auth/*          public
 *   /admin/**, /api/admin/**       admin only
 *   /select-role                   admin only (employees never see the chooser)
 *   everything else                any signed-in, non-suspended user
 *
 * Role + status are read from `profiles` on EVERY request (one indexed
 * primary-key lookup), so promoting, demoting or suspending someone takes
 * effect immediately - no waiting for their JWT to expire.
 *
 * If an external service calls one of our API routes without a browser
 * session (webhook/callback), add its path to PUBLIC_API_PREFIXES below and
 * authenticate it with a shared secret inside the route instead.
 */
const PUBLIC_API_PREFIXES: string[] = [];

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getUser() validates the token with Supabase's auth server (and refreshes
  // it if needed). Never trust getSession() for authorisation decisions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect/JSON helpers that carry over any refreshed session cookies.
  const withCookies = (target: NextResponse) => {
    response.cookies.getAll().forEach((c) => target.cookies.set(c));
    return target;
  };
  const redirectTo = (path: string) => withCookies(NextResponse.redirect(new URL(path, request.url)));
  const deny = (status: 401 | 403, error: string) => withCookies(NextResponse.json({ error }, { status }));

  // ---- Not signed in ------------------------------------------------------
  if (!user) {
    if (isPublicPath(pathname)) return response;
    if (isApi) return deny(401, "Not signed in");
    const login = new URL("/", request.url);
    login.searchParams.set("next", pathname + search);
    return withCookies(NextResponse.redirect(login));
  }

  // ---- Signed in: look up role + status (RLS: user may read own row) ------
  const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", user.id).maybeSingle();

  const role = profile?.role as UserRole | undefined;
  const active = !!profile && profile.status === "Active" && !!role;

  if (!active) {
    // Suspended, or an auth user with no profile: treat as signed out.
    if (isApi) return deny(403, "Account disabled");
    if (pathname === "/" || pathname.startsWith("/auth/")) return response; // sign-in page / signout still reachable
    return redirectTo("/?error=suspended");
  }

  // Signed-in users hitting the sign-in page get routed by role.
  if (pathname === "/") return redirectTo("/auth/continue");
  if (pathname.startsWith("/auth/") || isPublicPath(pathname)) return response;

  const adminOnly =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin/") ||
    pathname === "/select-role";

  if (adminOnly && role !== "admin") {
    if (isApi) return deny(403, "Administrator access required");
    return redirectTo(HOME_BY_ROLE.employee);
  }

  return response;
}

export const config = {
  // Skip Next internals and static assets (public/images, videos, favicons...).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ico|woff2?)$).*)"],
};
