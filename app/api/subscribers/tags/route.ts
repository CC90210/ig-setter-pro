import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    subscriber_id: string;
    tag_id: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.subscriber_id || !body.tag_id) {
    return NextResponse.json({ error: "subscriber_id and tag_id are required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    await db().execute({
      sql: `INSERT OR IGNORE INTO subscriber_tags (subscriber_id, tag_id, added_at) VALUES (?, ?, ?)`,
      args: [body.subscriber_id, body.tag_id, now],
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[subscribers/tags/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const subscriberId = req.nextUrl.searchParams.get("subscriber_id");
  const tagId = req.nextUrl.searchParams.get("tag_id");

  if (!subscriberId || !tagId) {
    return NextResponse.json({ error: "subscriber_id and tag_id are required" }, { status: 400 });
  }

  try {
    await db().execute({
      sql: "DELETE FROM subscriber_tags WHERE subscriber_id = ? AND tag_id = ?",
      args: [subscriberId, tagId],
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[subscribers/tags/DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
