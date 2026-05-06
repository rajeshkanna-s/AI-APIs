create table if not exists public.ai_api_custom_builds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  endpoint_url text not null,
  method text not null default 'POST',
  auth_header_name text not null default 'Authorization',
  auth_prefix text not null default 'Bearer',
  access_token_hash text not null,
  tokens jsonb not null default '[]'::jsonb,
  models jsonb not null default '[]'::jsonb,
  sample_curl text,
  input_sample jsonb,
  output_sample jsonb,
  request_body_template jsonb,
  extra_headers jsonb not null default '{}'::jsonb,
  max_loops integer not null default 2 check (max_loops between 1 and 2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_ai_api_custom_builds_updated_at on public.ai_api_custom_builds;
create trigger set_ai_api_custom_builds_updated_at
before update on public.ai_api_custom_builds
for each row execute function public.set_ai_api_updated_at();

alter table public.ai_api_custom_builds enable row level security;
