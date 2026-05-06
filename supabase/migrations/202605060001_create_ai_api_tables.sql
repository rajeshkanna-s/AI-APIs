create extension if not exists pgcrypto;

create table if not exists public.ai_api_models (
  id uuid primary key default gen_random_uuid(),
  priority integer not null,
  name text not null unique,
  provider text not null default 'nvidia',
  active boolean not null default true,
  max_tokens_limit integer not null default 4096,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_api_token_slots (
  id uuid primary key default gen_random_uuid(),
  priority integer not null,
  display_name text not null,
  secret_name text not null unique,
  provider text not null default 'nvidia',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_ai_api_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ai_api_models_updated_at on public.ai_api_models;
create trigger set_ai_api_models_updated_at
before update on public.ai_api_models
for each row execute function public.set_ai_api_updated_at();

drop trigger if exists set_ai_api_token_slots_updated_at on public.ai_api_token_slots;
create trigger set_ai_api_token_slots_updated_at
before update on public.ai_api_token_slots
for each row execute function public.set_ai_api_updated_at();

alter table public.ai_api_models enable row level security;
alter table public.ai_api_token_slots enable row level security;
drop policy if exists "Public can read ai api models" on public.ai_api_models;
create policy "Public can read ai api models"
on public.ai_api_models
for select
to anon, authenticated
using (true);

drop policy if exists "Public can manage ai api models" on public.ai_api_models;
create policy "Public can manage ai api models"
on public.ai_api_models
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Public can read ai api token slots" on public.ai_api_token_slots;
create policy "Public can read ai api token slots"
on public.ai_api_token_slots
for select
to anon, authenticated
using (true);

drop policy if exists "Public can manage ai api token slots" on public.ai_api_token_slots;
create policy "Public can manage ai api token slots"
on public.ai_api_token_slots
for all
to anon, authenticated
using (true)
with check (true);

insert into public.ai_api_token_slots (priority, display_name, secret_name, provider, active)
values
  (1, 'NVIDIA Token 1', 'token-1', 'nvidia', true),
  (2, 'NVIDIA Token 2', 'token-2', 'nvidia', true)
on conflict (secret_name) do update set
  priority = excluded.priority,
  display_name = excluded.display_name,
  provider = excluded.provider,
  active = excluded.active;

insert into public.ai_api_models (priority, name, provider, active)
values
  (1, 'qwen/qwen3-coder-480b-a35b-instruct', 'nvidia', true),
  (2, 'meta/llama-4-maverick-17b-128e-instruct', 'nvidia', true),
  (3, 'deepseek-ai/deepseek-v3.1', 'nvidia', true),
  (4, 'openai/gpt-oss-120b', 'nvidia', true),
  (5, 'meta/llama-3.2-90b-vision-instruct', 'nvidia', true),
  (6, 'nvidia/usdcode', 'nvidia', true),
  (7, 'moonshotai/kimi-k2-instruct', 'nvidia', true),
  (8, 'abacusai/dracarys-llama-3.1-70b-instruct', 'nvidia', true),
  (9, 'meta/llama-3.1-70b-instruct', 'nvidia', true),
  (10, 'meta/llama-3.3-70b-instruct', 'nvidia', true),
  (11, 'mistralai/mistral-nemotron', 'nvidia', true),
  (12, 'nvidia/llama-3.3-nemotron-super-49b-v1.5', 'nvidia', true),
  (13, 'qwen/qwen2.5-coder-32b-instruct', 'nvidia', true),
  (14, 'mistralai/magistral-small-2506', 'nvidia', true),
  (15, 'mistralai/mistral-medium-3-instruct', 'nvidia', true),
  (16, 'openai/gpt-oss-20b', 'nvidia', true),
  (17, 'microsoft/phi-4-multimodal-instruct', 'nvidia', true),
  (18, 'meta/llama-3.2-11b-vision-instruct', 'nvidia', true),
  (19, 'sarvamai/sarvam-m', 'nvidia', true),
  (20, 'z-ai/glm4.7', 'nvidia', true),
  (21, 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1', 'nvidia', true),
  (22, 'google/gemma-3n-e4b-it', 'nvidia', true),
  (23, 'nvidia/nemotron-mini-4b-instruct', 'nvidia', true),
  (24, 'nvidia/nvidia-nemotron-nano-3b-v2', 'nvidia', true),
  (25, 'meta/llama-3.2-3b-instruct', 'nvidia', true),
  (26, 'google/gemma-3n-e2b-it', 'nvidia', true),
  (27, 'google/gemma-2-2b-it', 'nvidia', true),
  (28, 'meta/llama-3.2-1b-instruct', 'nvidia', true)
on conflict (name) do update set
  priority = excluded.priority,
  provider = excluded.provider,
  active = excluded.active;
