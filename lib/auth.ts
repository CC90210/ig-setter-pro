import { NextRequest, NextResponse } from "next/server";

/**
 * Validate dashboard API requests.
 *
 * Three accept paths, in order:
 *  1. GET requests are unauthenticated (read-only)
 *  2. Same-origin browser requests (the dashboard UI calling its own API).
 *     These are trusted because the dashboard is a single-tenant tool.
 *  3. Cross-origin requests (Python daemon, curl, scripts) must present
 *     x-api-secret or x-webhook-secret matching WEBHOOK_SECRET.
 */
export function requireAuth(req: NextRequest): NextResponse | null {
  if (req.method === "GET") return null;

  // Same-origin check: dashboard UI fetches share the host/origin with the
  // API route. This avoids forcing the client to ship the WEBHOOK_SECRET in
  // its JS bundle.
  const origin = (req.headers.get("origin") || "").trim();
  const host = (req.headers.get("host") || "").trim();
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return null;
    } catch {
      // Malformed Origin header — fall through to secret check
    }
  }

  const secret = req.headers.get("x-api-secret") || req.headers.get("x-webhook-secret");
  const expected = (process.env.WEBHOOK_SECRET || "").trim();
  if (expected && secret === expected) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
