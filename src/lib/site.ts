/**
 * Who runs RamAI and how to reach them — shown on the Contact and legal pages.
 * Leave a field null until it's known: pages only show what's filled in.
 * Razorpay asks for the owner's legal name, a phone number and an address
 * before payments go live.
 */
export const SITE = {
  name: "RamAI",
  url: "https://ram-ai-liard.vercel.app",
  email: "ramrajkansana100@gmail.com",
  /** Full legal name of the person or company that runs RamAI. */
  owner: "Dr. Ramraj Singh Kansana" as string | null,
  /** Shown as written; dialled as digits. */
  phone: "+91 88179 73879" as string | null,
  /** The same number takes WhatsApp messages. */
  whatsapp: true,
  address: null as string | null,
  /** How quickly support replies. */
  replyWithin: "2 working days",
  /** When the legal pages last changed. */
  updated: "9 October 2026",
} as const;

/** "RamAI" — or "RamAI, run by <owner>" once the owner is filled in. */
export const operator = () => (SITE.owner ? `${SITE.name}, run by ${SITE.owner}` : SITE.name);

export const LEGAL_LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund-policy", label: "Refunds" },
  { href: "/shipping-policy", label: "Shipping & delivery" },
  { href: "/disclaimer", label: "Disclaimer" },
] as const;

/** tel: and WhatsApp links for the support number. */
export const phoneDigits = () => (SITE.phone ?? "").replace(/[^\d+]/g, "");
export const whatsappLink = () => (SITE.phone && SITE.whatsapp ? `https://wa.me/${phoneDigits().replace(/^\+/, "")}` : null);
