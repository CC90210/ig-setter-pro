import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET — Fetch active sequence enrollments with next_step_at <= now
// Called by scheduled automation every 5 minutes to execute sequence steps
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();

    const enrollments = await db().execute({
      sql: `SELECT se.id, se.sequence_id, se.thread_id, se.current_step, se.status,
              s.name as sequence_name,
              t.ig_user_id, t.username, t.display_name, t.account_id
            FROM sequence_enrollments se
            JOIN sequences s ON s.id = se.sequence_id
            JOIN dm_threads t ON t.id = se.thread_id
            WHERE se.status = 'active' AND se.next_step_at <= ?
            ORDER BY se.next_step_at ASC
            LIMIT 50`,
      args: [now],
    });

    // For each enrollment, fetch the current step
    const results = [];
    for (const row of enrollments.rows) {
      const enrollment = row as unknown as {
        id: string; sequence_id: string; thread_id: string;
        current_step: number; ig_user_id: string;
        username: string; display_name: string; account_id: string;
      };

      const stepResult = await db().execute({
        sql: "SELECT * FROM sequence_steps WHERE sequence_id = ? AND step_order = ? LIMIT 1",
        args: [enrollment.sequence_id, enrollment.current_step],
      });

      if (stepResult.rows.length === 0) {
        // No more steps — mark completed
        await db().execute({
          sql: "UPDATE sequence_enrollments SET status = 'completed', completed_at = ? WHERE id = ?",
          args: [now, enrollment.id],
        });
        continue;
      }

      const step = stepResult.rows[0] as unknown as {
        message_template: string; delay_minutes: number; step_order: number;
      };

      // Template variable replacement
      let message = step.message_template
        .replace(/\{\{username\}\}/g, enrollment.username || "")
        .replace(/\{\{display_name\}\}/g, enrollment.display_name || "");

      // Count total steps for this sequence
      const totalResult = await db().execute({
        sql: "SELECT COUNT(*) as cnt FROM sequence_steps WHERE sequence_id = ?",
        args: [enrollment.sequence_id],
      });
      const totalSteps = (totalResult.rows[0] as unknown as { cnt: number }).cnt;

      results.push({
        enrollment_id: enrollment.id,
        sequence_id: enrollment.sequence_id,
        thread_id: enrollment.thread_id,
        ig_user_id: enrollment.ig_user_id,
        account_id: enrollment.account_id,
        current_step: enrollment.current_step,
        total_steps: totalSteps,
        message,
        action: "send",
      });

      // Advance to next step or complete
      const nextStep = enrollment.current_step + 1;
      const nextStepResult = await db().execute({
        sql: "SELECT delay_minutes FROM sequence_steps WHERE sequence_id = ? AND step_order = ? LIMIT 1",
        args: [enrollment.sequence_id, nextStep],
      });

      if (nextStepResult.rows.length > 0) {
        const delay = (nextStepResult.rows[0] as unknown as { delay_minutes: number }).delay_minutes;
        const nextAt = new Date(Date.now() + delay * 60 * 1000).toISOString();
        await db().execute({
          sql: "UPDATE sequence_enrollments SET current_step = ?, next_step_at = ? WHERE id = ?",
          args: [nextStep, nextAt, enrollment.id],
        });
      } else {
        await db().execute({
          sql: "UPDATE sequence_enrollments SET status = 'completed', completed_at = ? WHERE id = ?",
          args: [now, enrollment.id],
        });
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("[sequences/pending]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
