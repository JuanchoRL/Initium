create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'recruiter',
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  department text not null,
  location text not null,
  status text not null default 'active',
  owner text not null,
  score_profile_id text not null default 'generalist',
  job_description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_name text not null,
  candidate_email text not null,
  candidate_phone text,
  recruiter_email text not null,
  expires_at timestamptz not null,
  status text not null default 'sent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_results (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invite_id uuid references public.assessment_invites(id) on delete set null,
  candidate_name text not null,
  candidate_email text not null,
  role text not null,
  completed_at timestamptz not null,
  strategy_profile text,
  personality_profile text,
  personality_subtype text,
  scores jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  total_score integer not null,
  technical_score integer not null,
  cognitive_score integer not null,
  soft_skills_score integer not null,
  fit_scores jsonb not null default '{}'::jsonb,
  imported_candidate_id uuid,
  score_profile_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assessment_result_id text references public.assessment_results(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  total_score integer,
  technical_score integer,
  cognitive_score integer,
  soft_skills_score integer,
  fit_scores jsonb,
  status text not null default 'pending',
  pipeline_stage text not null default 'assessment',
  recruiter_notes text,
  raw_scores jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.recruiter_memberships enable row level security;
alter table public.jobs enable row level security;
alter table public.assessment_invites enable row level security;
alter table public.assessment_results enable row level security;
alter table public.candidates enable row level security;

create or replace function public.user_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.recruiter_memberships
  where user_id = auth.uid()
     or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create policy "recruiters read own organizations"
on public.organizations
for select
using (id in (select public.user_organization_ids()));

create policy "recruiters read own memberships"
on public.recruiter_memberships
for select
using (organization_id in (select public.user_organization_ids()));

create policy "recruiters manage own jobs"
on public.jobs
for all
using (organization_id in (select public.user_organization_ids()))
with check (organization_id in (select public.user_organization_ids()));

create policy "recruiters manage own invites"
on public.assessment_invites
for all
using (organization_id in (select public.user_organization_ids()))
with check (organization_id in (select public.user_organization_ids()));

create policy "recruiters read own assessment results"
on public.assessment_results
for select
using (organization_id in (select public.user_organization_ids()));

create policy "recruiters manage own candidates"
on public.candidates
for all
using (organization_id in (select public.user_organization_ids()))
with check (organization_id in (select public.user_organization_ids()));

create index if not exists idx_jobs_organization_id on public.jobs(organization_id);
create unique index if not exists idx_recruiter_memberships_org_email on public.recruiter_memberships(organization_id, lower(email));
create index if not exists idx_assessment_invites_organization_id on public.assessment_invites(organization_id);
create index if not exists idx_assessment_results_organization_id on public.assessment_results(organization_id);
create index if not exists idx_candidates_organization_id on public.candidates(organization_id);
