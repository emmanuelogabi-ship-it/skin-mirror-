// delete-account — permanently deletes the caller's photos, data and login.
// POST (Authorization: Bearer <user access token>)
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const userDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return new Response('Not signed in', { status: 401, headers: cors });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const bucket = admin.storage.from('skin-photos');

  // Delete every photo under <user_id>/<scan_id>/...
  const { data: scanFolders } = await bucket.list(user.id, { limit: 1000 });
  for (const folder of scanFolders ?? []) {
    const prefix = `${user.id}/${folder.name}`;
    const { data: files } = await bucket.list(prefix, { limit: 1000 });
    if (files?.length) await bucket.remove(files.map((f) => `${prefix}/${f.name}`));
  }

  // Deleting the auth user cascades to profiles, scans and findings.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return new Response('Could not delete account', { status: 500, headers: cors });

  return new Response(JSON.stringify({ deleted: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
