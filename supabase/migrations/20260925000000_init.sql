-- Skin Mirror — Phase 1 schema
-- Profiles, scans and AI findings. Every table is locked down with row-level
-- security so a user can only ever read their own data. AI results are written
-- by the analyze-skin Edge Function using the service role.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  birth_year int check (birth_year between 1900 and 2100),
  skin_type text check (skin_type in ('dry', 'oily', 'combination', 'normal', 'sensitive', 'unsure')),
  sensitivities text[] not null default '{}',
  pregnant_or_breastfeeding boolean not null default false,
  budget text check (budget in ('low', 'medium', 'high')),
  timezone text,
  terms_accepted_at timestamptz,
  photo_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Create an empty profile row whenever someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Scans (one capture session = 1–5 photos)
-- ---------------------------------------------------------------------------
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  status text not null default 'uploading'
    check (status in ('uploading', 'processing', 'complete', 'retake', 'error')),
  image_paths text[] not null default '{}',
  quality jsonb,            -- { ok, issues[], advice }
  summary text,             -- plain-language overview for the user
  red_flags jsonb not null default '[]'::jsonb,  -- [{ sign, reason }]
  referral_level text not null default 'none'
    check (referral_level in ('none', 'pharmacist', 'gp', 'urgent')),
  model text,
  error text
);

create index scans_user_created on public.scans (user_id, created_at desc);

alter table public.scans enable row level security;

create policy "scans: read own" on public.scans
  for select using (auth.uid() = user_id);
create policy "scans: create own" on public.scans
  for insert with check (auth.uid() = user_id and status = 'uploading');
-- Users may only attach their uploaded photo paths while the scan is still uploading.
create policy "scans: attach photos while uploading" on public.scans
  for update using (auth.uid() = user_id and status = 'uploading')
  with check (auth.uid() = user_id and status = 'uploading');
create policy "scans: delete own" on public.scans
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Findings (one row per detected concern)
-- ---------------------------------------------------------------------------
create table public.scan_findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  concern text not null check (concern in (
    'acne', 'blackheads', 'enlarged_pores', 'dark_spots', 'uneven_tone',
    'redness', 'dryness', 'oiliness', 'fine_lines', 'wrinkles',
    'dark_circles', 'puffiness', 'texture', 'dullness', 'scarring'
  )),
  face_region text not null check (face_region in (
    'forehead', 'between_brows', 'under_eyes', 'nose', 'left_cheek',
    'right_cheek', 'upper_lip', 'chin', 'jawline', 'full_face'
  )),
  severity int not null check (severity between 1 and 5),
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  notes text,
  created_at timestamptz not null default now()
);

create index scan_findings_user_concern on public.scan_findings (user_id, concern, created_at);

alter table public.scan_findings enable row level security;

create policy "findings: read own" on public.scan_findings
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Private photo storage: skin-photos/<user_id>/<scan_id>/<n>.jpg
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('skin-photos', 'skin-photos', false, 5242880, array['image/jpeg']);

create policy "photos: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'skin-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'skin-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'skin-photos' and (storage.foldername(name))[1] = auth.uid()::text);
