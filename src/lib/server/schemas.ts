import "server-only";

import { z } from "zod";

import { ALL_SPECIALTIES } from "@/engine/progression";
import { COUNTRIES } from "@/engine/countries";
import { CARE_LEVELS, CASE_TRACKS, PATIENT_LANGS } from "@/engine/types";
import { PREFERRED_SPECIALTIES } from "@/lib/specialty";

const CountryField = z.enum(COUNTRIES as unknown as [string, ...string[]]);

const Specialty = z.enum(ALL_SPECIALTIES as [string, ...string[]]);
const Token = z.string().min(20).max(400_000);

export const StartSchema = z.object({
  /** The guided demo case. */
  tutorial: z.boolean().optional(),
  /** Today's daily case — the same patient for everyone. */
  daily: z.boolean().optional(),
  /** "any": every specialty this time, whatever the doctor's own. */
  specialty: z.union([Specialty, z.literal("any")]).optional(),
  track: z.enum(CASE_TRACKS as unknown as [string, ...string[]]).optional(),
  level: z.enum(CARE_LEVELS as unknown as [string, ...string[]]).optional(),
  /** "All resources": every test and treatment available. */
  unlimited: z.boolean().optional(),
  /** Two-player: invite a friend, find an opponent, play the computer — or a duel's id to join. */
  duel: z.union([z.enum(["invite", "find", "computer"]), z.string().regex(/^[a-f0-9]{12}$/)]).optional(),
  /** The same patient again: the finished case's token. */
  retry: z.string().min(20).max(400_000).optional(),
  /** A disease to practise. */
  disease: z.string().trim().min(2).max(80).regex(/^[\p{L}\p{N} ,.'()\/-]+$/u).optional(),
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
  period: z.enum(["monthly"]),
  /** The buyer asked for Pro to start at once (giving up a statutory cancellation period, where one applies). */
  startNow: z.literal(true, { error: "Please confirm you want Pro to start straight away." }),
});
const RazorpayId = (prefix: string) => z.string().trim().max(80).regex(new RegExp(`^${prefix}_[A-Za-z0-9]+$`), "Invalid id.");
export const VerifySchema = z.object({ orderId: RazorpayId("order"), paymentId: RazorpayId("pay"), signature: z.string().trim().regex(/^[a-f0-9]{64}$/, "Invalid signature.") });
export const OrderStatusSchema = z.object({ orderId: RazorpayId("order") });
export const DonateSchema = z.object({
  rupees: z.number().int("Whole rupees, please.").min(10, "The smallest gift is ₹10.").max(50_000, "The largest gift is ₹50,000."),
  name: z.string().trim().max(60).optional(),
  message: z.string().trim().max(300).optional(),
});

export const TurnSchema = z.object({
  token: Token,
  input: z.string().min(1).max(1000),
});

export const ResumeSchema = z.object({ token: Token });

export const SettingsSchema = z
  .object({
    patientLang: z.enum(PATIENT_LANGS as unknown as [string, ...string[]]).optional(),
    country: CountryField.optional(),
    specialty: z.enum(PREFERRED_SPECIALTIES as unknown as [string, ...string[]]).optional(),
  })
  .refine((s) => s.patientLang !== undefined || s.country !== undefined || s.specialty !== undefined, "Nothing to change.");
