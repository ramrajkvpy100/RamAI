import "server-only";

import { z } from "zod";

import { ALL_SPECIALTIES } from "@/engine/progression";
import { COUNTRIES } from "@/engine/countries";
import { CARE_LEVELS, CASE_TRACKS, PATIENT_LANGS } from "@/engine/types";

const CountryField = z.enum(COUNTRIES as unknown as [string, ...string[]]);

const Specialty = z.enum(ALL_SPECIALTIES as [string, ...string[]]);
const Token = z.string().min(20).max(400_000);

export const StartSchema = z.object({
  /** The guided demo case. */
  tutorial: z.boolean().optional(),
  /** Today's daily case — the same patient for everyone. */
  daily: z.boolean().optional(),
  specialty: Specialty.optional(),
  track: z.enum(CASE_TRACKS as unknown as [string, ...string[]]).optional(),
  level: z.enum(CARE_LEVELS as unknown as [string, ...string[]]).optional(),
});

export const SignupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60),
  username: z.string().trim().min(3, "At least 3 characters").max(24).regex(/^[a-zA-Z0-9._]+$/, "Letters, numbers, dots and underscores only"),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  password: z.string().min(8, "At least 8 characters").max(200),
  country: CountryField.optional(),
  /** Ticked by the player: 18 or over, and agrees to the Terms and Privacy policy. */
  acceptTerms: z.literal(true, { error: "Please confirm you're 18 or over and accept the Terms and Privacy policy." }),
});

export const GuestSchema = z.object({ country: CountryField.optional() });

export const ForgotSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email").max(120) });

/** A new password, with the proof from the emailed link: a token hash (our email template) or a PKCE code (Supabase's default). */
export const ResetSchema = z.object({
  password: z.string().min(8, "At least 8 characters").max(200),
  tokenHash: z.string().min(10).max(500).optional(),
  code: z.string().min(10).max(500).optional(),
});

/** The six-digit code from the sign-up email (Supabase can be set to send longer ones). */
export const VerifyCodeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  code: z.string().trim().regex(/^\d{6,10}$/, "Enter the 6-digit code from the email."),
});

/** A confirmation link from Supabase's default email: the PKCE code it carries. */
export const ConfirmLinkSchema = z.object({ code: z.string().min(10).max(500) });

export const ResendSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email").max(120) });

export const LoginSchema = z.object({
  login: z.string().trim().min(3).max(120),
  password: z.string().min(1).max(200),
});

export const CheckoutSchema = z.object({
  period: z.enum(["monthly", "yearly"]),
  /** The buyer asked for Pro to start at once (giving up a statutory cancellation period, where one applies). */
  startNow: z.literal(true, { error: "Please confirm you want Pro to start straight away." }),
});
export const VerifySchema = z.object({ orderId: z.string().max(80), paymentId: z.string().max(80), signature: z.string().max(200) });

export const TurnSchema = z.object({
  token: Token,
  input: z.string().min(1).max(1000),
});

export const ResumeSchema = z.object({ token: Token });

export const SettingsSchema = z
  .object({
    patientLang: z.enum(PATIENT_LANGS as unknown as [string, ...string[]]).optional(),
    country: CountryField.optional(),
  })
  .refine((s) => s.patientLang !== undefined || s.country !== undefined, "Nothing to change.");
