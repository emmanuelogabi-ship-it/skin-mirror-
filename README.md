# Skin Mirror

AI skin analysis and skincare habit app (Expo / React Native + Supabase + Claude).

Users take three guided face photos; Claude analyses visible cosmetic concerns (dark spots, uneven tone,
texture, fine lines, breakouts…) on a 1–5 scale, checks photo quality, and flags anything that should be
seen by a pharmacist or doctor instead of treated with skincare.

## What's built (Phase 1)

| Area | Where |
|---|---|
| Welcome → email-code sign-in → consent (18+, photo consent) → skin profile | `src/app/welcome.tsx`, `sign-in.tsx`, `consent.tsx`, `profile-setup.tsx` |
| Guided 3-angle camera capture with face oval, or pick from library | `src/app/scan.tsx` |
| Photos resized + EXIF stripped on device, uploaded to a private bucket | `src/lib/scan.ts` |
| Claude analysis (server-side only), structured output, safety rules, daily limit | `supabase/functions/analyze-skin`, `supabase/functions/_shared/analysis.ts` |
| Results: quality/retake, referral card, findings with severity | `src/app/result/[id].tsx` |
| Today, History, Settings (edit profile, sign out, delete account + all photos) | `src/app/(tabs)/` |
| Database, row-level security, storage policies | `supabase/migrations/` |

Next phases (see the product plan): routine builder + daily checklist + reminders + streaks → progress
comparison + weekly recap → coach chat + label scanner → shopping.

## Setup

### 1. Supabase (can be done in the browser)
1. Create a project at [supabase.com](https://supabase.com). Pick an EU/UK region if most users are there.
2. **SQL Editor** → paste and run `supabase/migrations/20260925000000_init.sql`.
3. **Authentication → Emails → Magic Link template**: make sure the body includes `{{ .Token }}` so users
   receive a 6-digit code (e.g. `Your Skin Mirror code is {{ .Token }}`).
4. **Project Settings → API**: copy the URL and anon/publishable key into `.env` (see `.env.example`).

### 2. Server functions (needs a computer with Node)
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # from console.anthropic.com
npx supabase functions deploy analyze-skin
npx supabase functions deploy delete-account
```
Optional secrets: `CLAUDE_MODEL` (default `claude-sonnet-5`), `DAILY_SCAN_LIMIT` (default `10`).

### 3. Run the app
```bash
npm install
cp .env.example .env    # then fill it in
npx expo start
```
Scan the QR code with **Expo Go** on your phone (camera, image picker and image manipulator all work in
Expo Go). For a standalone build: `npx eas-cli@latest build --profile development`.

## Checks
```bash
npm test          # analysis safety/normalisation tests
npm run typecheck
npx expo lint
```

## Safety & privacy decisions
- Positioned as **cosmetic** guidance, not diagnosis. The model is told never to name diseases or medicines;
  rashes, irregular moles, infection signs, severe acne and swelling become red flags with a
  pharmacist / GP / urgent referral. Get a regulatory review (MHRA, EU MDR, FDA) before launch.
- Face photos are treated as sensitive data: explicit consent screen, private bucket with per-user
  policies, EXIF stripped, signed URLs that expire in 10 minutes, one-tap account + photo deletion.
- Adults only (birth-year gate, and the model refuses photos that appear to show someone under 18).
- The Claude API key only exists as a Supabase secret; the app never sees it.
- The analysis prompt asks for fair assessment across all skin tones. Build an evaluation set of consented
  photos across skin tones before launch and re-run it after every prompt change.
