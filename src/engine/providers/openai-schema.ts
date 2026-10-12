/**
 * Zod schemas for everything the language model returns. Model output is
 * never trusted: it is validated here, then mapped onto engine structures.
 */
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Turn interpretation                                                         */
/* -------------------------------------------------------------------------- */

export const IntentSchema = z.object({
  kind: z.enum(["greeting", "history", "vitals", "exam", "investigation", "drug", "action", "followup", "wait", "reassess", "diagnosis", "differential", "close", "unknown"]),
  targetId: z.string().max(80).optional(),
  phrase: z.string().max(400).default(""),
  payload: z.record(z.string(), z.union([z.string().max(300), z.number(), z.boolean()])).optional(),
});

/** The structured patient response contract (spec §42). */
export const PatientResponseSchema = z.object({
  type: z.literal("patient_response"),
  message: z.string().max(800),
  new_information: z.array(z.object({ label: z.string().max(60), value: z.string().max(300) })).max(6).default([]),
  intents: z.array(IntentSchema).max(8).default([]),
  /** Engine-owned fields are accepted for contract compatibility but ignored. */
  vitals: z.record(z.string(), z.unknown()).optional(),
  state_changes: z.array(z.unknown()).optional(),
  investigation_results: z.array(z.unknown()).optional(),
  patient_status: z.string().optional(),
  case_status: z.string().optional(),
});
export type PatientResponse = z.infer<typeof PatientResponseSchema>;

/* -------------------------------------------------------------------------- */
/* Patient voice                                                               */
/* -------------------------------------------------------------------------- */

/** One reply per question asked, in order. */
export const VoiceSchema = z.object({ replies: z.array(z.string().max(700)).max(8) });

/* -------------------------------------------------------------------------- */
/* Debrief feedback                                                            */
/* -------------------------------------------------------------------------- */

export const FeedbackSchema = z.object({
  summary: z.string().min(1).max(800),
  reasoning: z.string().min(1).max(800),
  nextTime: z.array(z.string().min(1).max(260)).min(1).max(4),
});
