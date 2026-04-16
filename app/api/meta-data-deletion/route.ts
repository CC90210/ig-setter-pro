import { NextRequest, NextResponse } from "next/server";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Meta Data Deletion Callback
 *
 * Spec: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 *
 * Meta POSTs a URL-encoded form with a single `signed_request` parameter.
 * The signed_request is `<base64url_signature>.<base64url_payload>` where the
 * signature is HMAC-SHA256(payload, APP_SECRET). Payload is a JSON object
 * containing at minimum: { user_id, algorithm, issued_at }.
 *
 * We must:
 *  1. Verify the signature using FB_APP_SECRET.
 *  2. Delete records tied to the user_id from subscribers, dm_threads,
 *     dm_messages, and comment_events.
 *  3. Return JSON: { url, confirmation_code } where `url` is a public page
 *     the user can visit to verify status, and `confirmation_code` is a
 *     unique ID for the deletion request.
 */

function base64UrlDecode(input: string): Buffer {
  // Meta uses base64url; convert to standard base64 then decode.
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

  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest();
  const providedSig = base64UrlDecode(encodedSig);

  // Constant-time comparison
  if (
    expectedSig.length !== providedSig.length ||
    !crypto.timingSafeEqual(expectedSig, providedSig)
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
  } catch {
    return null;
  }
}

async function deleteUserData(igUserId: string): Promise<void> {
  const client = db();

  // Delete in child-first order to respect any FK constraints.
  // All four tables carry ig_user_id directly.
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
      "[meta-data-deletion] FB_APP_SECRET is not configured. Add it to environment variables."
    );
    return NextResponse.json(
      {
        error:
          "Server misconfiguration: FB_APP_SECRET is missing. Configure the Meta app secret before Meta can verify deletion callbacks.",
      },
      { status: 500 }
    );
  }

  // Meta sends application/x-www-form-urlencoded with `signed_request`.
  // Accept JSON as well for resilience.
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
  } catch (err) {
    console.error("[meta-data-deletion] failed to parse body", err);
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
  const confirmationCode = crypto.randomUUID();

  try {
    await deleteUserData(igUserId);
  } catch (err) {
    console.error("[meta-data-deletion] deletion failed", err);
    return NextResponse.json(
      { error: "Failed to delete user data" },
      { status: 500 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://ig-setter-pro.vercel.app";

  return NextResponse.json({
    url: `${baseUrl}/data-deletion?confirmation=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}

// Allow GET for simple health-check / Meta verification ping.
export async function GET() {
  return NextResponse.json({
    endpoint: "meta-data-deletion",
    method: "POST",
    note: "POST a Meta signed_request to this endpoint to trigger deletion.",
  });
}
