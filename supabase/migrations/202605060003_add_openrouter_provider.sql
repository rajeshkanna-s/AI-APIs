create table if not exists public.ai_api_provider_urls (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  chat_completions_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_ai_api_provider_urls_updated_at on public.ai_api_provider_urls;
create trigger set_ai_api_provider_urls_updated_at
before update on public.ai_api_provider_urls
for each row execute function public.set_ai_api_updated_at();

alter table public.ai_api_provider_urls enable row level security;

drop policy if exists "Public can read ai api provider urls" on public.ai_api_provider_urls;
create policy "Public can read ai api provider urls"
on public.ai_api_provider_urls
for select
to anon, authenticated
using (true);

drop policy if exists "Public can manage ai api provider urls" on public.ai_api_provider_urls;
create policy "Public can manage ai api provider urls"
on public.ai_api_provider_urls
for all
to anon, authenticated
using (true)
with check (true);

insert into public.ai_api_provider_urls (provider, chat_completions_url, active)
values
  ('nvidia', 'https://integrate.api.nvidia.com/v1/chat/completions', true),
  ('openrouter', 'https://openrouter.ai/api/v1/chat/completions', true)
on conflict (provider) do update set
  chat_completions_url = excluded.chat_completions_url,
  active = excluded.active;

insert into public.ai_api_token_slots (priority, display_name, secret_name, provider, active)
values
  (1, 'OpenRouter AI Agent 1', 'openrouter-token-1', 'openrouter', true),
  (2, 'OpenRouter AI Agent 2', 'openrouter-token-2', 'openrouter', true),
  (3, 'OpenRouter AI Agent 3', 'openrouter-token-3', 'openrouter', true),
  (4, 'OpenRouter AI Agent 4', 'openrouter-token-4', 'openrouter', true),
  (5, 'OpenRouter AI Agent 5', 'openrouter-token-5', 'openrouter', true),
  (6, 'OpenRouter AI Agent 6', 'openrouter-token-6', 'openrouter', true),
  (7, 'OpenRouter AI Agent 7', 'openrouter-token-7', 'openrouter', true),
  (8, 'OpenRouter AI Agent 8', 'openrouter-token-8', 'openrouter', true),
  (9, 'OpenRouter AI Agent 9', 'openrouter-token-9', 'openrouter', true),
  (10, 'OpenRouter AI Agent 10', 'openrouter-token-10', 'openrouter', true),
  (11, 'OpenRouter AI Agent 11', 'openrouter-token-11', 'openrouter', true)
on conflict (secret_name) do update set
  priority = excluded.priority,
  display_name = excluded.display_name,
  provider = excluded.provider,
  active = excluded.active;

insert into public.ai_api_models (priority, name, provider, active)
values
  (1, 'openai/gpt-oss-120b:free', 'openrouter', true),
  (2, 'nvidia/nemotron-3-super-120b-a12b:free', 'openrouter', true),
  (3, 'qwen/qwen3-next-80b-a3b-instruct:free', 'openrouter', true),
  (4, 'meta-llama/llama-3.3-70b-instruct:free', 'openrouter', true),
  (5, 'google/gemma-4-31b-it:free', 'openrouter', true),
  (6, 'google/gemma-3-27b-it:free', 'openrouter', true),
  (7, 'google/gemma-4-26b-a4b-it:free', 'openrouter', true),
  (8, 'openai/gpt-oss-20b:free', 'openrouter', true),
  (9, 'qwen/qwen3-coder:free', 'openrouter', true),
  (10, 'google/gemma-3-12b-it:free', 'openrouter', true),
  (11, 'nvidia/nemotron-3-nano-30b-a3b:free', 'openrouter', true),
  (12, 'z-ai/glm-4.5-air:free', 'openrouter', true),
  (13, 'google/gemma-3-4b-it:free', 'openrouter', true),
  (14, 'nvidia/nemotron-nano-12b-v2-vl:free', 'openrouter', true),
  (15, 'google/gemma-3n-e4b-it:free', 'openrouter', true),
  (16, 'meta-llama/llama-3.2-3b-instruct:free', 'openrouter', true),
  (17, 'nvidia/nemotron-nano-9b-v2:free', 'openrouter', true),
  (18, 'google/gemma-3n-e2b-it:free', 'openrouter', true),
  (19, 'nvidia/llama-nemotron-embed-vl-1b-v2:free', 'openrouter', true)
on conflict (name) do update set
  priority = excluded.priority,
  provider = excluded.provider,
  active = excluded.active;
