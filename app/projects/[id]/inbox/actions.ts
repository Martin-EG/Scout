"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/db/auth";
import { applyDraftAction } from "@/lib/db/inbox";

const inputSchema = z.object({
  draftId: z.uuid(),
  body: z.string().trim().min(1, "The draft is empty."),
  action: z.enum(["approve", "posted", "reject"]),
});

export type DraftActionResult = { error?: string };

export async function draftAction(draftId: string, body: string, action: string): Promise<DraftActionResult> {
  const user = await requireUser();
  const input = inputSchema.safeParse({ draftId, body, action });
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Invalid input." };
  try {
    await applyDraftAction(input.data.draftId, input.data.body, input.data.action);
  } catch (err) {
    console.error("[inbox] draft action failed", { userId: user.id, draftId, action, err });
    return { error: "Could not save. Try again." };
  }
  refresh();
  return {};
}
