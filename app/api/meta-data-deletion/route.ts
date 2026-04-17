import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { db } from "@/lib/db";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Meta Data Deletion Callback
 * Spec: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 */

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(normalized, "base64");
}

function parseSignedRequest(
  signedRequest: string,
  appSecret: string
): { user_id?: string; algorithm?: string; issued_at?: number } | null {
  const parts = signedRequest.split(".");
  if (parts.length !== 2) return null;

  const [encodedSig, encodedPayload] = parts;

  const expectedSig = createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest();
  const providedSig = base64UrlDecode(encodedSig);

  if (
    expectedSig.length !== providedSig.length ||
    !timingSafeEqual(expectedSig, providedSig)
  ) {
    return null;
  }

  try {
    const payloadJson = base64UrlDecode(encodedPayload).toString("utf8");
    const payload = JSON.parse(payloadJson);
    if (payload.algorithm && payload.algorithm !== "HMAC-SHA256") {
      return null;
    }
    return payload;
  } catch (_e) {
    return null;
  }
}

async function deleteUserData(igUserId: string): Promise<void> {
  const client = db();

  await client.execute({
    sql: "DELETE FROM dm_messages WHERE thread_id IN (SELECT id FROM dm_threads WHERE ig_user_id = ?)",
    args: [igUserId],
  });

  await client.execute({
    sql: "DELETE FROM dm_threads WHERE ig_user_id = ?",
    args: [igUserId],
  });

  await client.execute({
    sql: "DELETE FROM comment_events WHERE ig_user_id = ?",
    args: [igUserId],
  });

  await client.execute({
    sql: "DELETE FROM subscribers WHERE ig_user_id = ?",
    args: [igUserId],
  });
}

export async function POST(req: NextRequest) {
  const appSecret = (process.env.FB_APP_SECRET || "").trim();
  if (!appSecret) {
    console.error(
      "[meta-data-deletion] FB_APP_SECRET is not configured."
    );
    return NextResponse.json(
      { error: "FB_APP_SECRET is missing." },
      { status: 500 }
    );
  }

  let signedRequest: string | null = null;

  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const body = await req.json();
      signedRequest = body?.signed_request ?? null;
    } else {
      const form = await req.formData();
      const value = form.get("signed_request");
      if (typeof value === "string") signedRequest = value;
    }
  } catch (_e) {
    console.error("[meta-data-deletion] failed to parse body", _e);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!signedRequest) {
    return NextResponse.json(
      { error: "Missing signed_request parameter" },
      { status: 400 }
    );
  }

  const payload = parseSignedRequest(signedRequest, appSecret);
  if (!payload || !payload.user_id) {
    return NextResponse.json(
      { error: "Invalid or unverifiable signed_request" },
      { status: 400 }
    );
  }

  const igUserId = String(payload.user_id);
  const confirmationCode = randomUUID();

  try {
    await deleteUserData(igUserId);
  } catch (_e) {
    console.error("[meta-data-deletion] deletion failed", _e);
    return NextResponse.json(
      { error: "Failed to delete user data" },
      { status: 500 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://ig-setter-pro.vercel.app";

  return NextResponse.json({
    url: baseUrl + "/data-deletion?confirmation=" + confirmationCode,
    confirmation_code: confirmationCode,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "meta-data-deletion",
    method: "POST",
    note: "POST a Meta signed_request to this endpoint to trigger deletion.",
  });
}
