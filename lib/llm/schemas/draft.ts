import { z } from "zod";

export const draftSchema = z.object({
  body: z.string().trim().min(1),
  /** ISO 639-1, e.g. "en", "es". */
  language: z
    .string()
    .trim()
    .min(2)
    .transform((value) => value.toLowerCase().slice(0, 2)),
});

export type DraftOutput = z.infer<typeof draftSchema>;

const MANUAL_PLATFORMS = ["tiktok", "instagram", "facebook", "youtube", "newsletter", "pinterest", "discord", "other"] as const;

export const manualVenueSchema = z.object({
  platform: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.enum(MANUAL_PLATFORMS).catch("other"),
  ),
  name: z.string().trim().min(2).max(120),
  why: z.string().trim().min(1).max(400),
  draft: z.string().trim().min(1),
  language: z.string().trim().min(2).transform((value) => value.toLowerCase().slice(0, 2)).catch("en"),
});

export const manualVenuesSchema = z.object({
  venues: z.array(manualVenueSchema),
});

export type ManualVenueOutput = z.infer<typeof manualVenueSchema>;
