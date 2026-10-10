/**
 * Password rules (NIST SP 800-63B): long enough, not one of the passwords
 * attackers try first, and not built from the account's own name or email.
 */
import "server-only";

const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "p@ssw0rd", "p@ssword", "12345678", "123456789", "1234567890", "0123456789",
  "87654321", "11111111", "00000000", "12341234", "11223344", "123123123", "qwerty123", "qwertyuiop", "qwerty12", "1q2w3e4r",
  "1qaz2wsx", "zaq12wsx", "asdfghjkl", "asdf1234", "zxcvbnm1", "iloveyou", "iloveyou1", "sunshine", "princess", "football",
  "baseball", "superman", "batman123", "trustno1", "welcome1", "welcome123", "letmein1", "admin123", "administrator", "monkey123",
  "dragon123", "shadow123", "master123", "abc12345", "abcd1234", "abcdefgh", "computer", "internet", "whatever", "starwars",
  "india123", "india@123", "bharat123", "jaishriram", "jaihind123", "krishna123", "ganesh123", "doctor123", "doctor@123", "medical123",
  "mbbs1234", "mbbs@123", "neet2024", "neet2025", "neet2026", "aiims123", "stethoscope", "hospital123", "nurse123", "health123",
  "ramai123", "ramai@123", "clinical1", "patient123", "changeme", "changeme1", "test1234", "testtest", "secret123", "default1",
]);

/** Why a password isn't acceptable, or null when it's fine. */
export function passwordProblem(password: string, who: { email?: string; username?: string; name?: string } = {}): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 200) return "That password is too long.";
  const p = password.toLowerCase();
  if (COMMON.has(p) || /^(.)\1+$/.test(p) || /^(?:0123456789|1234567890|9876543210|abcdefgh|qwertyui)/.test(p)) {
    return "That password is too easy to guess. Try a short phrase or a mix of words and numbers.";
  }
  const personal = [who.username, who.email?.split("@")[0], ...(who.name?.split(/[\s.]+/) ?? []), "ramai"]
    .map((x) => x?.toLowerCase().replace(/^dr$/, ""))
    .filter((x): x is string => !!x && x.length >= 4);
  if (personal.some((x) => p.includes(x))) return "Don't use your name, username or email in your password.";
  return null;
}
