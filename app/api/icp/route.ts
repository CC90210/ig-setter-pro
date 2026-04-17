/**
 * GET /api/icp?account_id=X   — get ICP config
 * PUT /api/icp                — upsert ICP config
 */

import { NextRequest, NextResponse } from "next/server";
import { db, generateId, type IcpConfig } from "@/lib/db";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id required" }, { status: 400 });
  }
  const res = await db().execute({
    sql: "SELECT * FROM icp_configs WHERE account_id = ? LIMIT 1",
    args: [accountId],
  });
  const config = res.rows[0] as unknown as IcpConfig | undefined;
  return NextResponse.json({ config: config ?? null });
}

export async function PUT(req: NextRequest) {
  let body: {
    account_id: string;
    allowed_regions?: string[];
    blocked_regions?: string[];
    target_niches?: string[];
    excluded_niches?: string[];
    min_followers?: number;
    max_followers?: number | null;
    auto_archive_oop?: boolean;
    stale_days?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.account_id) {
    return NextResponse.json({ error: "account_id required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const allowed = JSON.stringify(body.allowed_regions ?? []);
  const blocked = JSON.stringify(body.blocked_regions ?? []);
  const niches = JSON.stringify(body.target_niches ?? []);
  const excluded = JSON.stringify(body.excluded_niches ?? []);
  const minFollowers = Math.max(0, body.min_followers ?? 0);
  const maxFollowers = body.max_followers ?? null;
  const autoArchive = body.auto_archive_oop ? 1 : 0;
  const staleDays = Math.max(1, Math.min(90, body.stale_days ?? 14));

  const existing = await db().execute({
    sql: "SELECT id FROM icp_configs WHERE account_id = ? LIMIT 1",
    args: [body.account_id],
  });

  if (existing.rows.length > 0) {
    await db().execute({
      sql: `UPDATE icp_configs SET
              allowed_regions = ?, blocked_regions = ?,
              target_niches = ?, excluded_niches = ?,
              min_followers = ?, max_followers = ?,
              auto_archive_oop = ?, stale_days = ?,
              updated_at = ?
            WHERE account_id = ?`,
      args: [allowed, blocked, niches, excluded, minFollowers, maxFollowers, autoArchive, staleDays, now, body.account_id],
    });
  } else {
    await db().execute({
      sql: `INSERT INTO icp_configs (
              id, account_id, allowed_regions, blocked_regions,
              target_niches, excluded_niches, min_followers, max_followers,
              auto_archive_oop, stale_days, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [generateId(), body.account_id, allowed, blocked, niches, excluded, minFollowers, maxFollowers, autoArchive, staleDays, now, now],
    });
  }

  return NextResponse.json({ ok: true });
}
