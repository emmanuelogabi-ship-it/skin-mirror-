-- Skin Mirror — Phase 2: routines, daily checklist, reminders, streaks.

-- ---------------------------------------------------------------------------
-- Product catalog (starter set of generic OTC ingredients/products, not
-- brands — swap in real linked products later without changing the schema).
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in (
    'cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'spf', 'eye_cream'
  )),
  key_ingredients text[] not null default '{}',
  targets text[] not null default '{}',        -- concerns this helps with (see scan_findings.concern)
  price_range text not null default 'medium' check (price_range in ('low', 'medium', 'high')),
  pregnancy_safe boolean not null default true,
  avoid_with text[] not null default '{}',      -- sensitivity labels that rule this out
  how_to_use text not null default '',
  affiliate_url text,
  active boolean not null default true
);

alter table public.products enable row level security;
create policy "products: readable by signed-in users" on public.products
  for select to authenticated using (active);

insert into public.products (name, category, key_ingredients, targets, price_range, pregnancy_safe, avoid_with, how_to_use) values
  ('Gentle Hydrating Cleanser', 'cleanser', array['glycerin','ceramides'], array['dryness','redness'], 'low', true, array[]::text[], 'Massage onto damp skin for 30 seconds, rinse with lukewarm water.'),
  ('Foaming Gel Cleanser', 'cleanser', array['salicylic acid 0.5%'], array['acne','oiliness','blackheads','enlarged_pores'], 'low', true, array['aha/bha acids'], 'Massage onto damp skin for 30–60 seconds, rinse well.'),
  ('Micellar Water', 'cleanser', array['glycerin'], array['dullness'], 'low', true, array[]::text[], 'Sweep over skin with a cotton pad; no need to rinse.'),
  ('Alcohol-Free Balancing Toner', 'toner', array['glycerin','panthenol'], array['redness','dryness'], 'low', true, array[]::text[], 'Pat into skin with clean hands after cleansing.'),
  ('Niacinamide 10% Serum', 'serum', array['niacinamide'], array['enlarged_pores','oiliness','uneven_tone','texture'], 'low', true, array[]::text[], 'A few drops on clean skin, morning or night, before moisturizer.'),
  ('Hyaluronic Acid Serum', 'serum', array['hyaluronic acid'], array['dryness','fine_lines'], 'medium', true, array[]::text[], 'Apply to damp skin, then seal with moisturizer.'),
  ('Vitamin C 15% Serum', 'serum', array['vitamin c','vitamin e'], array['dullness','dark_spots','uneven_tone'], 'medium', true, array['vitamin c'], 'A few drops in the morning before SPF. Introduce gradually.'),
  ('Azelaic Acid 10% Serum', 'treatment', array['azelaic acid'], array['redness','acne','dark_spots'], 'medium', true, array[]::text[], 'Apply a thin layer to clean skin, 3–5 nights a week at first.'),
  ('Salicylic Acid 2% Treatment', 'treatment', array['salicylic acid'], array['acne','blackheads','enlarged_pores'], 'low', true, array['aha/bha acids'], 'Apply to affected areas 2–3 evenings a week; increase slowly.'),
  ('Gentle Retinol 0.3% Night Cream', 'treatment', array['retinol'], array['fine_lines','wrinkles','texture','dark_spots'], 'medium', false, array['retinoids'], 'Pea-sized amount at night, 2 nights a week to start. Always follow with SPF the next morning.'),
  ('Centella (Cica) Repair Cream', 'treatment', array['centella asiatica'], array['redness','acne'], 'medium', true, array[]::text[], 'Apply a thin layer to calm and support the skin barrier.'),
  ('Ceramide Barrier Moisturizer', 'moisturizer', array['ceramides','cholesterol'], array['dryness','redness'], 'medium', true, array[]::text[], 'Apply morning and night as the last step before SPF.'),
  ('Lightweight Gel Moisturizer', 'moisturizer', array['hyaluronic acid','glycerin'], array['oiliness','enlarged_pores'], 'low', true, array[]::text[], 'Apply a thin layer to clean skin.'),
  ('Broad-Spectrum SPF 50', 'spf', array['zinc oxide'], array['dark_spots','uneven_tone','fine_lines','wrinkles'], 'low', true, array[]::text[], 'Apply generously every morning as the last step, and reapply if outdoors midday.'),
  ('Fragrance-Free Mineral SPF 30', 'spf', array['zinc oxide','titanium dioxide'], array['redness'], 'medium', true, array[]::text[], 'Apply generously every morning as the last step.'),
  ('Caffeine Eye Cream', 'eye_cream', array['caffeine','peptides'], array['dark_circles','puffiness'], 'medium', true, array[]::text[], 'Pat gently around the orbital bone morning and night.'),
  ('Peptide Eye Cream', 'eye_cream', array['peptides','hyaluronic acid'], array['fine_lines','dark_circles'], 'high', true, array[]::text[], 'Pat gently around the orbital bone at night.')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Routines
-- ---------------------------------------------------------------------------
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  built_from_scan_id uuid references public.scans (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index routines_user_active on public.routines (user_id, active);

alter table public.routines enable row level security;
create policy "routines: read own" on public.routines for select using (auth.uid() = user_id);
create policy "routines: delete own" on public.routines for delete using (auth.uid() = user_id);

create table public.routine_steps (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null check (period in ('am', 'pm')),
  step_order int not null default 0,
  product_id uuid references public.products (id) on delete set null,
  custom_name text,
  instructions text not null default '',
  frequency text not null default 'daily' check (frequency in ('daily', 'every_other_day', '3x_week', '2x_week')),
  wait_minutes int not null default 0
);
create index routine_steps_routine on public.routine_steps (routine_id, period, step_order);

alter table public.routine_steps enable row level security;
create policy "routine_steps: read own" on public.routine_steps for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Daily checklist ticks — one row per step actually completed on a given day.
-- ---------------------------------------------------------------------------
create table public.step_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  routine_step_id uuid not null references public.routine_steps (id) on delete cascade,
  log_date date not null default (now()::date),
  completed_at timestamptz not null default now(),
  unique (user_id, routine_step_id, log_date)
);
create index step_logs_user_date on public.step_logs (user_id, log_date desc);

alter table public.step_logs enable row level security;
create policy "step_logs: read own" on public.step_logs for select using (auth.uid() = user_id);
create policy "step_logs: create own" on public.step_logs for insert with check (auth.uid() = user_id);
create policy "step_logs: delete own" on public.step_logs for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Reminder preferences
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column am_reminder boolean not null default true,
  add column pm_reminder boolean not null default true;
