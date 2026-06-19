import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isClerkConfigured } from "@/lib/clerk/is-configured";

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/compare",
  "/privacy",
  "/terms",
  "/docs(.*)",
  "/roadmap(.*)",
  "/changelog(.*)",
  "/features(.*)",
  "/connectors(.*)",
  "/scenarios(.*)",
  "/dbt(.*)",
  "/invite/(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/dev-setup",
  "/api/webhooks/(.*)",
]);

function devPassthroughMiddleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname ?? "";
  if (pathname.startsWith("/api/") || pathname.startsWith("/trpc")) {
    return NextResponse.next();
  }
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }
  const url = new URL("/dev-setup", req.url);
  if (pathname !== "/dev-setup") url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

const clerkProtectedMiddleware = clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname ?? "";
  // App Router API handlers use `getCurrentDbUser()` / `auth()` and return JSON 401.
  // Do not redirect unauthenticated API calls to the HTML sign-in page (breaks `fetch` + JSON clients).
  if (pathname.startsWith("/api/") || pathname.startsWith("/trpc")) {
    return NextResponse.next();
  }

  if (!isPublicRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }
  }
});

export default isClerkConfigured() ? clerkProtectedMiddleware : devPassthroughMiddleware;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
