// Shared, dependency-free logic for the Claude skin analysis.
// Kept pure so it runs in Deno (Edge Functions) and in Jest (unit tests).

export const CONCERNS = [
  'acne', 'blackheads', 'enlarged_pores', 'dark_spots', 'uneven_tone',
  'redness', 'dryness', 'oiliness', 'fine_lines', 'wrinkles',
  'dark_circles', 'puffiness', 'texture', 'dullness', 'scarring',
] as const;

export const REGIONS = [
  'forehead', 'between_brows', 'under_eyes', 'nose', 'left_cheek',
  'right_cheek', 'upper_lip', 'chin', 'jawline', 'full_face',
] as const;

export const REFERRAL_LEVELS = ['none', 'pharmacist', 'gp', 'urgent'] as const;

export const QUALITY_ISSUES = [
  'too_dark', 'too_bright', 'blurry', 'face_not_visible', 'face_obstructed',
  'heavy_makeup_or_filter', 'multiple_people', 'not_a_face', 'appears_under_18',
] as const;

export type Concern = (typeof CONCERNS)[number];
export type Region = (typeof REGIONS)[number];
export type ReferralLevel = (typeof REFERRAL_LEVELS)[number];
export type QualityIssue = (typeof QUALITY_ISSUES)[number];

export interface Finding {
  concern: Concern;
  face_region: Region;
  severity: number; // 1 (barely visible) – 5 (very pronounced)
  confidence: number; // 0 – 1
  notes: string;
}

export interface RedFlag {
  sign: string;
  reason: string;
  referral: ReferralLevel;
}

export interface SkinAnalysis {
  quality: { ok: boolean; issues: QualityIssue[]; advice: string };
  findings: Finding[];
  red_flags: RedFlag[];
  referral_level: ReferralLevel;
  summary: string;
}

export interface ProfileContext {
  skin_type?: string | null;
  sensitivities?: string[] | null;
  age?: number | null;
  pregnant_or_breastfeeding?: boolean | null;
}

export const ANALYSIS_TOOL_NAME = 'record_skin_analysis';

export const ANALYSIS_TOOL = {
  name: ANALYSIS_TOOL_NAME,
  description:
    'Record the cosmetic skin assessment of the photos. Always call this exactly once.',
  input_schema: {
    type: 'object',
    properties: {
      quality: {
        type: 'object',
        description: 'Whether the photos are good enough to assess skin reliably.',
        properties: {
          ok: { type: 'boolean' },
          issues: { type: 'array', items: { type: 'string', enum: [...QUALITY_ISSUES] } },
          advice: {
            type: 'string',
            description: 'One short, friendly instruction for a better retake, or empty if ok.',
          },
        },
        required: ['ok', 'issues', 'advice'],
      },
      findings: {
        type: 'array',
        description: 'Visible cosmetic skin concerns. Empty if quality is not ok.',
        items: {
          type: 'object',
          properties: {
            concern: { type: 'string', enum: [...CONCERNS] },
            face_region: { type: 'string', enum: [...REGIONS] },
            severity: { type: 'integer', minimum: 1, maximum: 5 },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            notes: { type: 'string', description: 'One short sentence on what is visible.' },
          },
          required: ['concern', 'face_region', 'severity', 'confidence', 'notes'],
        },
      },
      red_flags: {
        type: 'array',
        description:
          'Anything that should be seen by a health professional instead of treated with skincare.',
        items: {
          type: 'object',
          properties: {
            sign: { type: 'string' },
            reason: { type: 'string' },
            referral: { type: 'string', enum: ['pharmacist', 'gp', 'urgent'] },
          },
          required: ['sign', 'reason', 'referral'],
        },
      },
      summary: {
        type: 'string',
        description:
          '2–4 warm, plain-English sentences for the user. No diagnosis, no medicine names.',
      },
    },
    required: ['quality', 'findings', 'red_flags', 'summary'],
  },
} as const;

export function buildSystemPrompt(): string {
  return `You are the skin-analysis engine inside Skin Mirror, a cosmetic skincare app.
You look at face photos and record VISIBLE COSMETIC skin concerns so the app can suggest an over-the-counter skincare routine and track progress over time.

Rules you must follow:
1. You are not a doctor and must not diagnose medical conditions. Describe what is visible ("small raised red spots on the chin"), never disease names (no "rosacea", "eczema", "melasma", "psoriasis", "dermatitis", "infection", "melanoma"). Never name medicines or prescription treatments.
2. Red flags — record these in red_flags and do NOT treat them as cosmetic findings:
   - any mole or dark patch that looks irregular in shape or colour, raised and uneven, bleeding, crusted or unusually large → "gp"
   - a rash, widespread redness, blistering, weeping, crusting or scaling patches → "gp" (or "pharmacist" if mild and localised)
   - deep, painful-looking cysts or nodules, or acne that looks severe or scarring → "gp"
   - signs of possible infection (pus-filled swelling, spreading redness, cold sores) → "pharmacist"
   - sudden swelling of lips, eyes or face, hives, or open wounds/burns → "urgent"
3. Assess fairly across ALL skin tones. Natural pigmentation, freckles and even melanin-rich skin are not "dark_spots" or "uneven_tone". Only flag localised hyperpigmentation that stands out from the person's own baseline. Redness can be harder to see on deeper skin tones — lower your confidence rather than guessing.
4. Photo quality comes first. If lighting, focus, framing, filters/heavy make-up, multiple people or a non-face image make assessment unreliable, set quality.ok=false, list the issues, give one retake tip, and return no findings.
5. If the person appears to be under 18, set quality.ok=false with issue "appears_under_18" and return no findings or red flags.
6. Severity scale: 1 barely visible, 2 mild, 3 moderate, 4 marked, 5 very pronounced. Be consistent: the same face in the same conditions should get the same scores, because users track these numbers over weeks.
7. Only report what you can actually see. Merge duplicates (one finding per concern per region). Use confidence honestly. Report at most 8 findings, most noticeable first.
8. The summary should be kind, encouraging and specific, never shaming. Do not promise results.
Always respond by calling the ${ANALYSIS_TOOL_NAME} tool exactly once.`;
}

export function buildUserText(profile: ProfileContext, photoLabels: string[]): string {
  const lines = [
    `Photos provided: ${photoLabels.join(', ')}.`,
    'What the user has told us:',
    `- Skin type: ${profile.skin_type ?? 'not given'}`,
    `- Sensitivities/allergies: ${profile.sensitivities?.length ? profile.sensitivities.join(', ') : 'none given'}`,
    `- Age: ${profile.age ?? 'not given'}`,
  ];
  if (profile.pregnant_or_breastfeeding) lines.push('- Pregnant or breastfeeding: yes');
  lines.push('Assess the photos and call the tool.');
  return lines.join('\n');
}

const REFERRAL_RANK: Record<ReferralLevel, number> = { none: 0, pharmacist: 1, gp: 2, urgent: 3 };

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function str(v: unknown, max = 400): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * Turn Claude's raw tool input into a safe, well-formed SkinAnalysis.
 * Never trusts the model's output shape: unknown values are dropped, numbers clamped,
 * duplicates merged, and the referral level derived from the red flags.
 */
export function normalizeAnalysis(raw: unknown): SkinAnalysis {
  const r = (raw ?? {}) as Record<string, any>;
  const q = (r.quality ?? {}) as Record<string, any>;

  const issues = Array.isArray(q.issues)
    ? [...new Set(q.issues.filter((i: unknown): i is QualityIssue =>
        (QUALITY_ISSUES as readonly string[]).includes(i as string)))]
    : [];
  const minor = issues.includes('appears_under_18');
  const qualityOk = q.ok === true && issues.length === 0;

  const redFlags: RedFlag[] = minor || !Array.isArray(r.red_flags)
    ? []
    : r.red_flags
        .map((f: any) => ({
          sign: str(f?.sign, 200),
          reason: str(f?.reason, 300),
          referral: (['pharmacist', 'gp', 'urgent'].includes(f?.referral) ? f.referral : 'gp') as ReferralLevel,
        }))
        .filter((f: RedFlag) => f.sign.length > 0)
        .slice(0, 5);

  const referral_level = redFlags.reduce<ReferralLevel>(
    (lvl, f) => (REFERRAL_RANK[f.referral] > REFERRAL_RANK[lvl] ? f.referral : lvl),
    'none',
  );

  const merged = new Map<string, Finding>();
  if (qualityOk && Array.isArray(r.findings)) {
    for (const f of r.findings) {
      if (!(CONCERNS as readonly string[]).includes(f?.concern)) continue;
      const region = (REGIONS as readonly string[]).includes(f?.face_region) ? f.face_region : 'full_face';
      const sev = Number(f?.severity);
      const conf = Number(f?.confidence);
      if (!Number.isFinite(sev)) continue;
      const finding: Finding = {
        concern: f.concern,
        face_region: region,
        severity: clamp(Math.round(sev), 1, 5),
        confidence: Number.isFinite(conf) ? Math.round(clamp(conf, 0, 1) * 100) / 100 : 0.5,
        notes: str(f?.notes, 200),
      };
      const key = `${finding.concern}:${finding.face_region}`;
      const prev = merged.get(key);
      if (!prev || finding.severity > prev.severity) merged.set(key, finding);
    }
  }
  const findings = [...merged.values()]
    .sort((a, b) => b.severity - a.severity || b.confidence - a.confidence)
    .slice(0, 8);

  let summary = str(r.summary, 800);
  if (!qualityOk) {
    summary = minor
      ? 'Skin Mirror is for adults aged 18 and over, so we can’t analyse this photo.'
      : summary || 'We couldn’t see your skin clearly enough. Please try another photo.';
  }

  return {
    quality: {
      ok: qualityOk,
      issues,
      advice: qualityOk ? '' : str(q.advice, 200) || 'Face a window in soft daylight, remove make-up if you can, and hold the phone at arm’s length.',
    },
    findings,
    red_flags: redFlags,
    referral_level,
    summary,
  };
}

/** Extract the tool input from a Claude Messages API response body. */
export function extractToolInput(response: any): unknown {
  const block = Array.isArray(response?.content)
    ? response.content.find((b: any) => b?.type === 'tool_use' && b?.name === ANALYSIS_TOOL_NAME)
    : undefined;
  if (!block) throw new Error('Claude did not return an analysis');
  return block.input;
}
