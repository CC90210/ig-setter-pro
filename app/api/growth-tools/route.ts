import { NextRequest, NextResponse } from "next/server";
import { db, generateId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const accountId = req.nextUrl.searchParams.get("account_id");

  try {
    let result;

    if (accountId) {
      result = await db().execute({
        sql: "SELECT * FROM growth_tools WHERE account_id = ? ORDER BY created_at DESC",
        args: [accountId],
      });
    } else {
      result = await db().execute("SELECT * FROM growth_tools ORDER BY created_at DESC");
    }

    return NextResponse.json({ growth_tools: result.rows });
  } catch (err) {
    console.error("[growth-tools/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    account_id: string;
    name: string;
    tool_type: "ref_url" | "qr_code" | "opt_in_keyword" | "landing_page";
    slug: string;
    auto_dm_message?: string;
    auto_tag_ids?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.account_id || !body.name || !body.tool_type || !body.slug) {
    return NextResponse.json({ error: "account_id, name, tool_type, and slug are required" }, { status: 400 });
  }

  const validTypes = ["ref_url", "qr_code", "opt_in_keyword", "landing_page"];
  if (!validTypes.includes(body.tool_type)) {
    return NextResponse.json({ error: "Invalid tool_type" }, { status: 400 });
  }

  // Sanitize slug: lowercase alphanumeric + hyphens only
  const sanitizedSlug = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const id = generateId();
  const now = new Date().toISOString();

  try {
    await db().execute({
      sql: `INSERT INTO growth_tools
            (id, account_id, name, tool_type, slug, auto_dm_message, auto_tag_ids, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      args: [
        id,
        body.account_id,
        body.name,
        body.tool_type,
        sanitizedSlug,
        body.auto_dm_message ?? null,
        JSON.stringify(body.auto_tag_ids ?? []),
        now,
      ],
    });

    return NextResponse.json({ growth_tool: { id, slug: sanitizedSlug } }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }
    console.error("[growth-tools/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  let body: {
    id: string;
    name?: string;
    auto_dm_message?: string | null;
    auto_tag_ids?: string[];
    is_active?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const fields: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic SQL args
    const args: any[] = [];

    if (body.name !== undefined) { fields.push("name = ?"); args.push(body.name); }
    if (body.auto_dm_message !== undefined) { fields.push("auto_dm_message = ?"); args.push(body.auto_dm_message); }
    if (body.auto_tag_ids !== undefined) { fields.push("auto_tag_ids = ?"); args.push(JSON.stringify(body.auto_tag_ids)); }
    if (body.is_active !== undefined) { fields.push("is_active = ?"); args.push(body.is_active ? 1 : 0); }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    args.push(body.id);
    await db().execute({
      sql: `UPDATE growth_tools SET ${fields.join(", ")} WHERE id = ?`,
      args,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[growth-tools/PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    await db().execute({ sql: "DELETE FROM growth_tools WHERE id = ?", args: [id] });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[growth-tools/DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
