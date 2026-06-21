import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - PWA assets that must be publicly fetchable WITHOUT a session, served
     *   with their real content-type: manifest.webmanifest, sw.js, /icons,
     *   /.well-known (TWA Digital Asset Links). Without these exclusions the
     *   auth middleware redirects logged-out fetches (e.g. PWABuilder, or the
     *   service-worker registration itself) to the login HTML page.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|js|ico)$).*)",
  ],
};
