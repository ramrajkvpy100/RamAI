/** Supabase Auth's answers, in plain words for players. Nothing here reveals whether an account exists. */
import "server-only";

import { isAuthApiError, isAuthError, isAuthRetryableFetchError } from "@supabase/supabase-js";

import { apiError } from "@/lib/server/http";

const LINK_EXPIRED = "This link has expired or was already used. Reset links work once, for one hour — ask for a new one.";

export function authFailure(err: unknown): Response {
  if (!isAuthError(err)) throw err;
  if (isAuthRetryableFetchError(err)) return apiError(503, "AUTH_UNAVAILABLE", "Sign-in is unavailable for a moment. Please try again.");
  const code = (err as { code?: string }).code ?? "";
  switch (code) {
    case "invalid_credentials":
      return apiError(401, "INVALID", "Incorrect email or password.");
    case "email_not_confirmed":
      return apiError(403, "VERIFY_REQUIRED", "Your email isn't verified yet. Enter the code we emailed you — or send a new one.");
    case "otp_expired":
      return apiError(400, "CODE_INVALID", "That code is wrong or has expired.");
    case "over_email_send_rate_limit":
      // Supabase's built-in email sends only a few an hour for the whole site until custom SMTP is set up.
      console.error("[ramai] Supabase's email limit was hit — set up custom SMTP (Authentication → Emails → SMTP Settings) and raise the limit (Authentication → Rate Limits).");
      return apiError(429, "RATE_LIMITED", "Our email service is busy right now. Please try again in a few minutes.");
    case "over_request_rate_limit":
      return apiError(429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.");
    case "email_address_invalid":
      return apiError(400, "BAD_INPUT", "Enter a valid email address.");
    case "email_address_not_authorized":
      // Supabase's built-in email only reaches the project's own team until custom SMTP is set up.
      console.error("[ramai] Supabase refused to email this address — set up custom SMTP (Authentication → Emails → SMTP Settings).");
      return apiError(503, "EMAIL_UNAVAILABLE", "We can't send email to this address yet. Please try again later.");
    case "weak_password":
      return apiError(400, "BAD_INPUT", err.message || "Choose a stronger password.");
    case "same_password":
      return apiError(400, "BAD_INPUT", "Choose a password different from your old one.");
    case "signup_disabled":
      return apiError(403, "SIGNUP_CLOSED", "New sign-ups are paused right now.");
    case "user_already_exists":
    case "email_exists":
      return apiError(409, "EXISTS", "An account with this email already exists. Log in instead.");
    case "flow_state_not_found":
    case "flow_state_expired":
    case "bad_code_verifier":
    // The link was opened in a different browser from the one that asked for it.
    case "pkce_code_verifier_not_found":
      return apiError(400, "LINK_EXPIRED", LINK_EXPIRED);
    case "session_not_found":
    case "refresh_token_not_found":
      return apiError(401, "UNAUTHENTICATED", "Please log in.");
    default:
      console.error("[ramai] Supabase Auth error:", code || err.name, err.message);
      if (isAuthApiError(err) && err.status >= 500) return apiError(503, "AUTH_UNAVAILABLE", "Sign-in is unavailable for a moment. Please try again.");
      return apiError(400, "BAD_REQUEST", "That didn't work. Please try again.");
  }
}

export { LINK_EXPIRED };
