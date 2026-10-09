/** Account emails: plain, branded, readable without images. */
import "server-only";

import type { Email } from "./mailer";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(heading: string, body: string, cta: { label: string; url: string }, footnote: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0b0f17">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e3e7ef;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:700;letter-spacing:-0.02em">Ram<span style="color:#2563eb">AI</span></td></tr>
<tr><td style="padding-top:24px;font-size:22px;font-weight:600;letter-spacing:-0.02em">${esc(heading)}</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:24px;color:#3d4657">${body}</td></tr>
<tr><td style="padding-top:24px"><a href="${esc(cta.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:999px">${esc(cta.label)}</a></td></tr>
<tr><td style="padding-top:20px;font-size:12.5px;line-height:20px;color:#6b7385">Or paste this link into your browser:<br><span style="word-break:break-all;color:#2563eb">${esc(cta.url)}</span></td></tr>
<tr><td style="padding-top:20px;font-size:12.5px;line-height:20px;color:#6b7385">${esc(footnote)}</td></tr>
</table>
<p style="font-size:12px;color:#8a92a3;margin-top:16px">RamAI · clinical case simulation for doctors</p>
</td></tr></table></body></html>`;
}

const firstName = (name: string) => esc(name.replace(/^dr\.?\s+/i, "").split(/\s+/)[0] || "doctor");

export function verifyEmailMessage(to: string, name: string, url: string): Email {
  return {
    to,
    subject: "Verify your email for RamAI",
    html: layout(
      "Confirm your email",
      `Hi Dr. ${firstName(name)}, confirm this is your email to join the weekly league and keep your account recoverable.`,
      { label: "Verify email", url },
      "The link works for 48 hours. If you didn't create a RamAI account, ignore this email.",
    ),
    text: `Confirm your email for RamAI:\n${url}\n\nThe link works for 48 hours. If you didn't create a RamAI account, ignore this email.`,
  };
}

export function resetPasswordMessage(to: string, name: string, url: string): Email {
  return {
    to,
    subject: "Reset your RamAI password",
    html: layout(
      "Reset your password",
      `Hi Dr. ${firstName(name)}, we got a request to reset your password. Choose a new one with the button below.`,
      { label: "Choose a new password", url },
      "The link works for 1 hour and only once. If you didn't ask for this, ignore this email — your password stays the same.",
    ),
    text: `Reset your RamAI password:\n${url}\n\nThe link works for 1 hour and only once. If you didn't ask for this, ignore this email.`,
  };
}
