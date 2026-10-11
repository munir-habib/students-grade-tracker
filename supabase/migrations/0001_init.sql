-- Grade Tracker ERP — initial schema, RLS policies, and default grade scale.
-- Run via `supabase db push` (or paste into the Supabase SQL editor) against a fresh project.

create extension if not exists pgcrypto;

create type role as enum ('student', 'admin');
create type theme_pref as enum ('system', 'light', 'dark');
create type calc_mode as enum ('points', 'category_percentage');
create type course_status as enum ('in_progress', 'completed', 'failed_retaking');
create type assessment_status as enum ('planned', 'pending', 'completed');

-- ============================================================================
-- profiles
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role role not null default 'student',
  theme_pref theme_pref not null default 'system',
  locale_pref text not null default 'en',
  only_last_attempt_counts boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- role is never client-writable: the bootstrap admin email is the only path to role='admin'.
-- If a future need arises to promote another account, do it directly in the SQL editor.
create function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_lock_role
  before update on public.profiles
  for each row execute function public.prevent_role_change();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_email constant text := 'admin@example.com'; -- replace with the email of your own admin account
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    case when new.email = admin_email then 'admin'::role else 'student'::role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admins may list accounts (name/email/created/last-seen) and NOTHING else — enforced here,
-- not just in the UI. No policy anywhere grants admins row access to courses/categories/assessments.
create function public.admin_account_list()
returns table (id uuid, name text, email text, created_at timestamptz, last_seen_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, u.email, p.created_at, p.last_seen_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where exists (
    select 1 from public.profiles me where me.id = auth.uid() and me.role = 'admin'
  );
$$;

revoke all on function public.admin_account_list() from public;
grant execute on function public.admin_account_list() to authenticated;

-- ============================================================================
-- grade scales (default US scale + per-student overrides)
-- ============================================================================

create table public.grade_scales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade, -- null = system default, visible to everyone
  name text not null
);

alter table public.grade_scales enable row level security;

create policy "grade_scales_select" on public.grade_scales
  for select using (user_id is null or auth.uid() = user_id);
create policy "grade_scales_insert_own" on public.grade_scales
  for insert with check (auth.uid() = user_id);
create policy "grade_scales_update_own" on public.grade_scales
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "grade_scales_delete_own" on public.grade_scales
  for delete using (auth.uid() = user_id);

create table public.grade_scale_bands (
  id uuid primary key default gen_random_uuid(),
  scale_id uuid not null references public.grade_scales (id) on delete cascade,
  min_pct numeric not null,
  letter text not null,
  gpa_points numeric not null
);

alter table public.grade_scale_bands enable row level security;

create policy "grade_scale_bands_select" on public.grade_scale_bands
  for select using (
    scale_id in (select id from public.grade_scales where user_id is null or user_id = auth.uid())
  );
create policy "grade_scale_bands_cud_own" on public.grade_scale_bands
  for all using (
    scale_id in (select id from public.grade_scales where user_id = auth.uid())
  ) with check (
    scale_id in (select id from public.grade_scales where user_id = auth.uid())
  );

insert into public.grade_scales (id, user_id, name)
values ('00000000-0000-0000-0000-000000000001', null, 'Default US GPA Scale');

insert into public.grade_scale_bands (scale_id, min_pct, letter, gpa_points) values
  ('00000000-0000-0000-0000-000000000001', 93, 'A', 4.0),
  ('00000000-0000-0000-0000-000000000001', 90, 'A-', 3.7),
  ('00000000-0000-0000-0000-000000000001', 87, 'B+', 3.3),
  ('00000000-0000-0000-0000-000000000001', 83, 'B', 3.0),
  ('00000000-0000-0000-0000-000000000001', 80, 'B-', 2.7),
  ('00000000-0000-0000-0000-000000000001', 77, 'C+', 2.3),
  ('00000000-0000-0000-0000-000000000001', 73, 'C', 2.0),
  ('00000000-0000-0000-0000-000000000001', 70, 'C-', 1.7),
  ('00000000-0000-0000-0000-000000000001', 0, 'F', 0.0);

-- ============================================================================
-- terms / courses / categories / assessments
-- ============================================================================

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  starts_on date,
  ends_on date,
  sort_order int not null default 0
);

alter table public.terms enable row level security;

create policy "terms_all_own" on public.terms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  term_id uuid not null references public.terms (id) on delete cascade,
  name text not null,
  credits numeric not null default 0,
  calc_mode calc_mode not null default 'points',
  status course_status not null default 'in_progress',
  retake_of_course_id uuid references public.courses (id) on delete set null,
  grade_scale_id uuid references public.grade_scales (id) on delete set null
);

alter table public.courses enable row level security;

create policy "courses_all_own" on public.courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  name text not null,
  weight_pct numeric,
  drop_lowest_count int not null default 0
);

alter table public.categories enable row level security;

create policy "categories_all_own" on public.categories
  for all using (
    course_id in (select id from public.courses where user_id = auth.uid())
  ) with check (
    course_id in (select id from public.courses where user_id = auth.uid())
  );

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null,
  date date,
  status assessment_status not null default 'planned',
  points_possible_syllabus numeric,
  points_possible_actual numeric,
  points_earned numeric,
  percent_direct numeric,
  comment text,
  constraint assessments_single_grade_field check (points_earned is null or percent_direct is null)
);

alter table public.assessments enable row level security;

create policy "assessments_all_own" on public.assessments
  for all using (
    category_id in (
      select c.id from public.categories c
      join public.courses co on co.id = c.course_id
      where co.user_id = auth.uid()
    )
  ) with check (
    category_id in (
      select c.id from public.categories c
      join public.courses co on co.id = c.course_id
      where co.user_id = auth.uid()
    )
  );
