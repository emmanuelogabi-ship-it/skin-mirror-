// build-routine — turns a user's latest scan + profile into an AM/PM routine
// using only products from our own catalog table.
// POST {}  (Authorization: Bearer <user access token>)
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  ROUTINE_TOOL_NAME,
  buildRoutineSystemPrompt,
  buildRoutineTool,
  buildRoutineUserText,
  normalizeRoutine,
} from '../_shared/routine.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: 'Server is missing ANTHROPIC_API_KEY' }, 500);

  const userDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return json({ error: 'Not signed in' }, 401);

  // Most recent completed scan and its findings — through RLS, so only ever this user's own.
  const { data: scan } = await userDb
    .from('scans')
    .select('id, scan_findings(concern, severity)')
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!scan) return json({ error: 'Complete a scan first — your routine is built from your results.' }, 400);

  const { data: profile } = await userDb
    .from('profiles')
    .select('skin_type, sensitivities, pregnant_or_breastfeeding, budget')
    .eq('id', user.id)
    .single();

  const { data: allProducts } = await userDb.from('products').select('*');
  const sensitivities = (profile?.sensitivities ?? []).map((s: string) => s.toLowerCase());
  // Filter unsafe products in code, not just by prompting the model — never send anything
  // pregnancy-unsafe or matching a stated sensitivity to Claude as an option at all.
  const catalog = (allProducts ?? []).filter((p) => {
    if (profile?.pregnant_or_breastfeeding && !p.pregnancy_safe) return false;
    const avoid: string[] = (p.avoid_with ?? []).map((a: string) => a.toLowerCase());
    if (avoid.some((a) => sensitivities.includes(a))) return false;
    return true;
  });
  if (!catalog.length) return json({ error: 'No safe products found for your profile right now.' }, 500);

  const findings = (scan.scan_findings ?? []).sort((a: any, b: any) => b.severity - a.severity);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const catalogForPrompt = catalog.map((p) => ({
      id: p.id, name: p.name, category: p.category, key_ingredients: p.key_ingredients, targets: p.targets, how_to_use: p.how_to_use,
    }));
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: [{ type: 'text', text: buildRoutineSystemPrompt(), cache_control: { type: 'ephemeral' } }],
        tools: [buildRoutineTool(catalogForPrompt)],
        tool_choice: { type: 'tool', name: ROUTINE_TOOL_NAME },
        messages: [{ role: 'user', content: buildRoutineUserText(findings, profile ?? {}, catalogForPrompt) }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = await res.json();
    const block = Array.isArray(body?.content) ? body.content.find((b: any) => b?.type === 'tool_use' && b?.name === ROUTINE_TOOL_NAME) : undefined;
    if (!block) throw new Error('Claude did not return a routine');

    const routine = normalizeRoutine(block.input, catalogForPrompt);
    if (!routine.steps.length) throw new Error('Routine came back empty');

    // Retire any previous active routine, then insert the new one + its steps.
    await admin.from('routines').update({ active: false }).eq('user_id', user.id).eq('active', true);
    const { data: newRoutine, error: routineErr } = await admin
      .from('routines')
      .insert({ user_id: user.id, built_from_scan_id: scan.id, active: true })
      .select('id')
      .single();
    if (routineErr || !newRoutine) throw routineErr ?? new Error('Could not create routine');

    const { error: stepsErr } = await admin.from('routine_steps').insert(
      routine.steps.map((s, i) => ({
        routine_id: newRoutine.id,
        user_id: user.id,
        period: s.period,
        step_order: i,
        product_id: s.product_id,
        custom_name: s.custom_name,
        instructions: s.instructions,
        frequency: s.frequency,
        wait_minutes: s.wait_minutes,
      })),
    );
    if (stepsErr) throw stepsErr;

    return json({ routine_id: newRoutine.id, note: routine.note, step_count: routine.steps.length });
  } catch (err) {
    console.error('build-routine failed', err);
    return json({ error: 'Could not build your routine. Please try again.' }, 502);
  }
});
