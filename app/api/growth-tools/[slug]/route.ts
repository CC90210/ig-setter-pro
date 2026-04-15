import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public endpoint — no auth required. Used for ref URLs, QR codes, keyword opt-ins.
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const result = await db().execute({
      sql: "SELECT * FROM growth_tools WHERE slug = ? AND is_active = 1 LIMIT 1",
      args: [params.slug],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const tool = result.rows[0] as unknown as {
      id: string;
      account_id: string;
      name: string;
      tool_type: string;
      slug: string;
      auto_dm_message: string | null;
      auto_tag_ids: string;
    };

    // Increment hit counter (fire-and-forget — don't block response)
    db()
      .execute({
        sql: "UPDATE growth_tools SET total_hits = total_hits + 1 WHERE id = ?",
        args: [tool.id],
      })
      .catch((err) => console.error("[growth-tools/slug] hit increment error", err));

    return NextResponse.json({ tool });
  } catch (err) {
    console.error("[growth-tools/slug]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
