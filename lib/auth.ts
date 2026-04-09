import { NextRequest, NextResponse } from "next/server";

/**
 * Validate dashboard API requests.
 * In production, this checks for the WEBHOOK_SECRET header.
 * This protects mutating endpoints from unauthorized access.
 */
export function requireAuth(req: NextRequest): NextResponse | null {
  // Allow GET requests without auth (read-only dashboard data)
  if (req.method === "GET") return null;

  const secret = req.headers.get("x-api-secret") || req.headers.get("x-webhook-secret");
  if (secret === process.env.WEBHOOK_SECRET) return null;

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
