"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/db/auth";
import { dismissLead } from "@/lib/db/leads";

export async function dismissLeadAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.uuid().parse(formData.get("id"));
  try {
    await dismissLead(id);
  } catch (err) {
    console.error("[leads] dismiss failed", { userId: user.id, leadId: id, err });
    throw new Error("Could not dismiss the lead.");
  }
  refresh();
}
