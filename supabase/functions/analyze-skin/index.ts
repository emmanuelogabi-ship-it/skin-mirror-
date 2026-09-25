// analyze-skin — sends a user's scan photos to Claude and stores the structured result.
// POST { scan_id }  (Authorization: Bearer <user access token>)
//
// Secrets (supabase secrets set ...):
//   ANTHROPIC_API_KEY   required
//   CLAUDE_MODEL        optional, defaults to claude-sonnet-5
//   DAILY_SCAN_LIMIT    optional, defaults to 10
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Buffer } from 'node:buffer';
import {
  ANALYSIS_TOOL,
  ANALYSIS_TOOL_NAME,
  buildSystemPrompt,
  buildUserText,
  extractToolInput,
  normalizeAnalysis,
} from '../_shared/analysis.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5';
const DAILY_LIMIT = Number(Deno.env.get('DAILY_SCAN_LIMIT') ?? '10');

const PHOTO_LABELS = ['front', 'left side', 'right side', 'close-up', 'close-up'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: 'Server is missing ANTHROPIC_API_KEY' }, 500);

  // 1. Who is calling? (user-scoped client — RLS applies)
  const authHeader = req.headers.get('Authorization') ?? '';
  const userDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return json({ error: 'Not signed in' }, 401);

  const { scan_id } = await req.json().catch(() => ({}));
  if (typeof scan_id !== 'string') return json({ error: 'scan_id is required' }, 400);

  // 2. Load the scan through RLS so users can only analyse their own.
  const { data: scan } = await userDb
    .from('scans')
    .select('id, status, image_paths')
    .eq('id', scan_id)
    .single();
  if (!scan) return json({ error: 'Scan not found' }, 404);
  if (scan.status !== 'uploading') return json({ error: 'Scan was already analysed' }, 409);

  const paths: string[] = scan.image_paths ?? [];
  if (paths.length < 1 || paths.length > 5 || !paths.every((p) => p.startsWith(`${user.id}/${scan_id}/`))) {
    return json({ error: 'Scan needs 1–5 uploaded photos' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 3. Cost guard: limit analyses per user per day.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('scans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['processing', 'complete', 'retake'])
    .gte('created_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return json({ error: `You can run ${DAILY_LIMIT} scans per day. Please try again tomorrow.` }, 429);
  }

  await admin.from('scans').update({ status: 'processing', model: MODEL }).eq('id', scan_id);

  try {
    // 4. Fetch photos + profile context.
    const images = await Promise.all(
      paths.map(async (p) => {
        const { data, error } = await admin.storage.from('skin-photos').download(p);
        if (error || !data) throw new Error(`Could not read photo ${p}`);
        return Buffer.from(await data.arrayBuffer()).toString('base64');
      }),
    );

    const { data: profile } = await admin
      .from('profiles')
      .select('skin_type, sensitivities, birth_year, pregnant_or_breastfeeding')
      .eq('id', user.id)
      .single();
    const age = profile?.birth_year ? new Date().getUTCFullYear() - profile.birth_year : null;

    // 5. Ask Claude.
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: [{ type: 'text', text: buildSystemPrompt(), cache_control: { type: 'ephemeral' } }],
        tools: [ANALYSIS_TOOL],
        tool_choice: { type: 'tool', name: ANALYSIS_TOOL_NAME },
        messages: [
          {
            role: 'user',
            content: [
              ...images.map((data) => ({
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data },
              })),
              {
                type: 'text',
                text: buildUserText(
                  { ...profile, age },
                  paths.map((_, i) => PHOTO_LABELS[i] ?? 'extra'),
                ),
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const analysis = normalizeAnalysis(extractToolInput(await res.json()));

    // 6. Store the result.
    if (analysis.findings.length) {
      const { error } = await admin.from('scan_findings').insert(
        analysis.findings.map((f) => ({ ...f, scan_id, user_id: user.id })),
      );
      if (error) throw error;
    }
    await admin
      .from('scans')
      .update({
        status: analysis.quality.ok ? 'complete' : 'retake',
        quality: analysis.quality,
        summary: analysis.summary,
        red_flags: analysis.red_flags,
        referral_level: analysis.referral_level,
      })
      .eq('id', scan_id);

    return json({ scan_id, ...analysis });
  } catch (err) {
    console.error('analyze-skin failed', err);
    await admin
      .from('scans')
      .update({ status: 'error', error: String(err).slice(0, 500) })
      .eq('id', scan_id);
    return json({ error: 'Analysis failed. Please try again.' }, 502);
  }
});
