// Shared, dependency-free routine-building logic. Pure so it runs in Deno and in tests.

export const PERIODS = ['am', 'pm'] as const;
export type Period = (typeof PERIODS)[number];

export const FREQUENCIES = ['daily', 'every_other_day', '3x_week', '2x_week'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const CATEGORIES = ['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'spf', 'eye_cream'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface CatalogProduct {
  id: string;
  name: string;
  category: Category;
  key_ingredients: string[];
  targets: string[];
  how_to_use: string;
}

export interface RoutineStepInput {
  period: Period;
  product_id: string | null;
  custom_name: string | null;
  instructions: string;
  frequency: Frequency;
  wait_minutes: number;
}

export interface RoutineResult {
  steps: RoutineStepInput[];
  note: string;
}

export const ROUTINE_TOOL_NAME = 'record_routine';

export function buildRoutineTool(catalog: CatalogProduct[]) {
  const ids = catalog.map((p) => p.id);
  return {
    name: ROUTINE_TOOL_NAME,
    description: 'Record the AM/PM skincare routine built from the catalog provided.',
    input_schema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          description:
            'Ordered routine steps. Cleanser first, treatments/serums middle, moisturizer then SPF (AM) last. 3–6 steps per period.',
          items: {
            type: 'object',
            properties: {
              period: { type: 'string', enum: [...PERIODS] },
              product_id: {
                type: 'string',
                description: 'Must be one of the given catalog ids, or omit for a plain instruction step (e.g. "Patch test").',
                enum: ids.length ? ids : undefined,
              },
              instructions: { type: 'string', description: 'One short, specific sentence on how/when to use this step.' },
              frequency: { type: 'string', enum: [...FREQUENCIES] },
              wait_minutes: { type: 'integer', minimum: 0, maximum: 30, description: 'Minutes to wait before the next step, 0 if none.' },
            },
            required: ['period', 'instructions', 'frequency', 'wait_minutes'],
          },
        },
        note: { type: 'string', description: 'One short, encouraging sentence introducing the routine. No promises of results.' },
      },
      required: ['steps', 'note'],
    },
  } as const;
}

export function buildRoutineSystemPrompt(): string {
  return `You build a simple, safe, over-the-counter AM/PM skincare routine for Skin Mirror, a cosmetic skincare app.

Rules:
1. Only recommend products from the catalog you are given, by their id. You may add a plain step with no product_id for things like "Patch test new products on your inner arm for 48 hours first."
2. Keep it simple: 3–6 steps per period (cleanser → treatment/serum → moisturizer → SPF in the morning). Do not recommend more than one exfoliating acid or retinoid step in the whole routine, and never on the same period as another active treatment.
3. Start actives (retinol, acids) at a low frequency (e.g. 2x_week) so the person can build tolerance, not daily.
4. Always include a morning SPF step unless none is in the catalog.
5. Never suggest prescription-strength ingredients or name medical conditions. This is cosmetic guidance only.
6. Keep instructions short, specific and encouraging.
Always respond by calling the ${ROUTINE_TOOL_NAME} tool exactly once.`;
}

export function buildRoutineUserText(
  findings: { concern: string; severity: number }[],
  profile: { skin_type?: string | null; sensitivities?: string[] | null; pregnant_or_breastfeeding?: boolean | null; budget?: string | null },
  catalog: CatalogProduct[],
): string {
  const lines = [
    `Skin type: ${profile.skin_type ?? 'not given'}`,
    `Sensitivities: ${profile.sensitivities?.length ? profile.sensitivities.join(', ') : 'none given'}`,
    `Pregnant or breastfeeding: ${profile.pregnant_or_breastfeeding ? 'yes' : 'no'}`,
    `Budget: ${profile.budget ?? 'not given'}`,
    '',
    'Top concerns from their latest scan (most severe first):',
    ...findings.slice(0, 6).map((f) => `- ${f.concern} (severity ${f.severity}/5)`),
    '',
    'Available catalog (id | category | name | key ingredients | helps with):',
    ...catalog.map((p) => `- ${p.id} | ${p.category} | ${p.name} | ${p.key_ingredients.join(', ')} | ${p.targets.join(', ')}`),
    '',
    'Build the routine and call the tool.',
  ];
  return lines.join('\n');
}

function clampInt(n: unknown, lo: number, hi: number, fallback: number): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

/** Validate and repair Claude's routine so nothing unsafe or malformed reaches storage. */
export function normalizeRoutine(raw: unknown, catalog: CatalogProduct[]): RoutineResult {
  const r = (raw ?? {}) as Record<string, any>;
  const catalogIds = new Set(catalog.map((p) => p.id));
  const treatmentIds = new Set(catalog.filter((p) => p.category === 'treatment').map((p) => p.id));

  let treatmentStepsSeen = 0;
  const steps: RoutineStepInput[] = (Array.isArray(r.steps) ? r.steps : [])
    .map((s: any): RoutineStepInput | null => {
      if (!PERIODS.includes(s?.period)) return null;
      const product_id = typeof s?.product_id === 'string' && catalogIds.has(s.product_id) ? s.product_id : null;
      const instructions = typeof s?.instructions === 'string' ? s.instructions.trim().slice(0, 300) : '';
      if (!instructions) return null;
      let frequency: Frequency = FREQUENCIES.includes(s?.frequency) ? s.frequency : 'daily';
      // Safety net: force any treatment-category product to a cautious cadence, whatever the model said.
      if (product_id && treatmentIds.has(product_id) && frequency === 'daily') frequency = '3x_week';
      return {
        period: s.period,
        product_id,
        custom_name: product_id ? null : (typeof s?.custom_name === 'string' ? s.custom_name.trim().slice(0, 100) : null),
        instructions,
        frequency,
        wait_minutes: clampInt(s?.wait_minutes, 0, 30, 0),
      };
    })
    .filter((s): s is RoutineStepInput => s !== null)
    // Safety net: allow at most one treatment-category step in the whole routine.
    .filter((s) => {
      if (!s.product_id || !treatmentIds.has(s.product_id)) return true;
      treatmentStepsSeen += 1;
      return treatmentStepsSeen <= 1;
    })
    .slice(0, 12);

  const note = typeof r.note === 'string' ? r.note.trim().slice(0, 400) : '';

  return {
    steps,
    note: note || 'Here’s a simple routine to start with — stick with the basics for a couple of weeks before adding more.',
  };
}

/** Given a step's frequency and how many days old the routine is, is it due today? */
export function isDueToday(frequency: Frequency, daysSinceStart: number): boolean {
  if (daysSinceStart < 0) return false;
  switch (frequency) {
    case 'daily':
      return true;
    case 'every_other_day':
      return daysSinceStart % 2 === 0;
    case '2x_week':
      return daysSinceStart % 7 === 0 || daysSinceStart % 7 === 3;
    case '3x_week':
      return daysSinceStart % 7 === 0 || daysSinceStart % 7 === 2 || daysSinceStart % 7 === 4;
    default:
      return true;
  }
}

const DAY_MS = 86_400_000;

function toEpochDay(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}
function fromEpochDay(e: number): string {
  return new Date(e * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Current and longest streak from a set of distinct "showed up" dates (YYYY-MM-DD, any step
 * logged that day). A grace day is banked every 7 counted days and spends automatically to
 * bridge a single missed day, so one bad day doesn't reset progress.
 */
export function computeStreak(loggedDates: string[], today: string): { current: number; longest: number } {
  const days = new Set(loggedDates);
  if (days.size === 0) return { current: 0, longest: 0 };

  function runEndingAt(startDay: number): number {
    let cursor = startDay;
    let count = 0;
    let grace = 1;
    let steps = 0;
    while (steps < 3650) {
      if (days.has(fromEpochDay(cursor))) {
        count += 1;
        if (count % 7 === 0) grace += 1;
      } else if (grace > 0) {
        grace -= 1;
      } else {
        break;
      }
      cursor -= 1;
      steps += 1;
    }
    return count;
  }

  const todayEpoch = toEpochDay(today);
  const start = days.has(fromEpochDay(todayEpoch)) ? todayEpoch : todayEpoch - 1;
  // Only start counting if the walk's first day actually has an entry — grace bridges a gap
  // *within* an active streak, it doesn't let us skip past today+yesterday both being empty.
  const current = days.has(fromEpochDay(start)) ? runEndingAt(start) : 0;

  const longest = [...days].reduce((best, d) => Math.max(best, runEndingAt(toEpochDay(d))), 0);

  return { current, longest: Math.max(longest, current) };
}
