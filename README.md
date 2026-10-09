# RamAI — think like a doctor, every day

A clinical case simulator for doctors and medical students in India. The player is the doctor; the patient answers only what is asked; orders are executed exactly as written — including the wrong ones — and the consequences unfold in simulated time. Teaching happens after the case closes.

**Modes:** OPD · Phone consult (no examination or tests — triage and advice) · Emergency
**Care levels:** Primary Health Centre → Community Health Centre → District Hospital → Medical College → Apex Institute (AIIMS-level) → Grand Rounds (rare-disease diagnostic puzzles). The level sets both difficulty and what the facility can do — a PHC can run a 20WBCT but not renal function.
**Habit loop:** XP, daily goal, streaks, badges, medical ranks (Medical Student → Master Clinician) and weekly leaderboards per mode.
**Freemium:** Free = 3 cases a day at PHC, CHC and District levels. Pro = unlimited cases and every level.

## Run

```bash
npm install
cp .env.example .env.local   # set RAMAI_SESSION_SECRET (≥ 32 chars)
npm run dev                  # http://localhost:3000
npm test                     # engine, case-lint, mode and server tests
npm run build && npm start   # production
```

Requires Node ≥ 22.13 (for the built-in `node:sqlite`). `/dev/media` (development only) shows every procedural clinical image. In development, `RAMAI_SEED_DEMO=1` fills the leaderboards with fictional players and `RAMAI_DEMO_BILLING=1` lets you switch on Pro without paying.

## Architecture

```
src/app                               pages: / (landing or home), /login, /signup, /case, /leaderboard, /profile, /pricing
  ↓ src/lib/engine-client.ts          browser client — every call goes through the API
/api/auth/* · /api/me                 accounts (scrypt), HttpOnly session cookie (hashed at rest)
/api/cases/*                          plan-gated case start, turns, resume — zod-validated, rate-limited
/api/leaderboard · /api/billing/*     weekly/all-time boards per mode; Razorpay orders + signature verification
  ↓ src/server                        db (node:sqlite) · auth · results (XP, streaks, ranks, boards) · billing
  ↓ src/engine/engine.ts              public engine API (server-only)
  ├ providers/                        mock (offline library + rules) | openai (generation + language)
  ├ intent.ts                         free text → structured intents
  ├ simulator.ts                      deterministic state machine: clock, results, hazards, rescue, phone & facility rules
  ├ levels.ts                         care levels, modes and what each facility can perform
  ├ physiology.ts                     global safety hazards from the hidden patient profile
  ├ reducer.ts                        effects → CaseState (isomorphic)
  ├ scoring.ts · debrief.ts           /100 rubric and teaching, released only at closure
  ├ progression.ts                    ranks, streaks, daily goal, badges (computed on the server)
  └ cases/                            server-only case library (hidden truth)
```

- **Hidden information stays hidden.** Case definitions are `server-only`. The browser holds an opaque AES-256-GCM-sealed token (case reference, owner, and the intent-resolved action log) and the revealed `CaseState`. Every turn the server unseals the token, checks it belongs to the signed-in user, and replays the log deterministically.
- **Scores can't be forged.** Results are recorded on the server when a case closes (once per session) and XP, ranks, streaks and leaderboards are computed from those records.
- **Consequences.** Hazards arm from case rules, global templates (allergy → anaphylaxis, PDE-5 + nitrate, fluid overload, opioid excess, hypoglycaemia, NSAID + thrombocytopenia, daily methotrexate) or omission (the appendix perforates, the viper coagulopathy bleeds, the porphyria attack paralyses). Stages show only observable signs; rescue windows decide the outcome; the debrief explains cause, harm, windows and the correct sequence.

## Cases (12)

| Level | Cases |
| --- | --- |
| PHC | Viper snakebite with consumption coagulopathy (20WBCT, ASV before referral) |
| CHC | Steroid-modified tinea · Dengue with warning signs |
| District | Acne · Melasma (OCP/TXA trap) · Appendicitis (penicillin allergy, perforation clock) · **Phone:** night-time chest pain (sildenafil + Sorbitrate trap) |
| Medical College | Psoriasis + PsA (weekly MTX) · Aorto-iliac PAD · Acute heart failure (IV-fluid trap) |
| Apex Institute | SLE with class IV lupus nephritis |
| Grand Rounds | Acute intermittent porphyria (porphyrinogenic-drug trap) |

Add cases in `src/engine/cases/` and register them in `cases/index.ts`; `tests/cases.test.ts` lints every cross-reference.

## Images

ECGs, X-rays, ultrasound, fundus and skin photographs are procedural vector renders driven by structured specs — players can ask to see any result again ("show me the ECG"). Set `media.src` on a case to use licensed photography instead. Photorealistic AI image generation is planned for the OpenAI step.

## Connecting OpenAI

Set `RAMAI_ENGINE=openai` and `OPENAI_API_KEY` (server-side only). `src/engine/providers/openai.ts` generates cases for any specialty, mode and level as JSON validated by `openai-schema.ts`, and handles free text the rules can't place (`patient_response` contract). Model output is recorded into the sealed log so replay never calls the model again; any failure falls back to the offline library and rules. **This path is written but not yet exercised against the live API.**

## Production notes

- `RAMAI_SESSION_SECRET` is required in production.
- SQLite suits a single server with a persistent volume (`RAMAI_DB_PATH`). For serverless or multiple instances, port the few tables in `src/server/db.ts` to Postgres — every query lives in `src/server/*`.
- Payments are one-time Razorpay orders for 30 or 365 days; Pro is activated only after the HMAC signature is verified on the server. Demo billing and demo players are disabled in production.
- Rate limiting is per instance; use a shared store at scale.

Clinical simulation for educational purposes. Cases are fictional.
