"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { confirmLink, googleSignIn } from "@/lib/engine-client";
import { clearMe } from "@/lib/me-store";

import { AuthFrame, AuthNotice, PRIMARY_LINK } from "./auth-ui";

/** Back from Google: swap the one-time code for a session, then carry on. */
export function OAuthCallback({ code, next, failed }: { code: string | null; next: string; failed: boolean }) {
  const [view, setView] = useState<"working" | "failed">(failed || !code ? "failed" : "working");
  const started = useRef(false);

  useEffect(() => {
    if (!code || failed || started.current) return;
    started.current = true;
    confirmLink(code)
      .then(() => {
        clearMe();
        window.location.replace(next);
      })
      .catch(() => setView("failed"));
  }, [code, failed, next]);

  return (
    <AuthFrame>
      {view === "working" ? (
        <AuthNotice tone="info" title="Signing you in…">
          One moment — Google has confirmed it&apos;s you.
        </AuthNotice>
      ) : (
        <AuthNotice
          tone="warning"
          title="That sign-in didn't finish"
          actions={
            <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className={PRIMARY_LINK}>
              Try again
            </Link>
          }
        >
          Google sign-in was cancelled or took too long. Please try once more.
        </AuthNotice>
      )}
    </AuthFrame>
  );
}

/** The public OAuth client id (not a secret — Google shows it in every sign-in URL). */
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "758025896647-8rvvrtpi59sa8t3ulh952dhg99ifo983.apps.googleusercontent.com";

interface GoogleId {
  initialize(options: { client_id: string; nonce: string; callback: (r: { credential?: string }) => void; ux_mode?: "popup"; use_fedcm_for_button?: boolean; itp_support?: boolean }): void;
  renderButton(el: HTMLElement, options: Record<string, unknown>): void;
}
declare global {
  interface Window { google?: { accounts?: { id?: GoogleId } } }
}

let gsi: Promise<GoogleId> | null = null;
function loadGsi(): Promise<GoogleId> {
  gsi ??= new Promise<GoogleId>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("gsi")));
    s.onerror = () => reject(new Error("gsi"));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error("gsi timeout")), 6000);
  }).catch((err) => {
    gsi = null;
    throw err;
  });
  return gsi;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * "Continue with Google" — Google's own button, so its screen names this site
 * rather than the Supabase project. If Google's script can't load, the
 * redirect button below takes over.
 */
export function GoogleButton({ next }: { next: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loading" | "google" | "fallback" | "working">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const raw = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
    Promise.all([loadGsi(), sha256Hex(raw)])
      .then(([id, hashed]) => {
        if (!live || !box.current) return;
        id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashed,
          ux_mode: "popup",
          use_fedcm_for_button: true,
          itp_support: true,
          callback: ({ credential }) => {
            if (!credential) return;
            setMode("working");
            setError(null);
            googleSignIn(credential, raw)
              .then(() => {
                clearMe();
                window.location.replace(next);
              })
              .catch((err: unknown) => {
                setMode("google");
                setError(err instanceof Error ? err.message : "Google sign-in didn't finish. Please try again.");
              });
          },
        });
        const width = Math.min(400, Math.max(200, Math.round(box.current.parentElement?.clientWidth ?? 320)));
        id.renderButton(box.current, { type: "standard", theme: "outline", size: "large", shape: "pill", text: "continue_with", logo_alignment: "center", width });
        setMode("google");
      })
      .catch(() => live && setMode("fallback"));
    return () => {
      live = false;
    };
  }, [next]);

  if (mode === "fallback") return <GoogleRedirectButton next={next} />;
  return (
    <div className="flex w-full flex-col items-center">
      <div ref={box} className={mode === "working" ? "pointer-events-none opacity-50" : ""} style={{ minHeight: 44 }} aria-busy={mode !== "google"} />
      {mode === "loading" && <div className="-mt-11 h-11 w-full animate-pulse rounded-full border border-line bg-surface-2" aria-hidden />}
      {mode === "working" && <p className="mt-2 text-[12.5px] text-fg-2">Signing you in…</p>}
      {error && <p role="alert" className="mt-2 text-center text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}

/** The redirect way (Supabase OAuth) — used only when Google's own button can't load. */
function GoogleRedirectButton({ next, label = "Continue with Google" }: { next: string; label?: string }) {
  return (
    <a
      href={`/api/auth/google${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-line bg-surface text-[14.5px] font-semibold text-fg shadow-sm transition-colors hover:bg-surface-2"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {label}
    </a>
  );
}
