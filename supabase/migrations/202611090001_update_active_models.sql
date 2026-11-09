-- Deactivate EOL NVIDIA models
update public.ai_api_models
set active = false
where provider = 'nvidia' and name in (
  'nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
  'google/gemma-3n-e4b-it',
  'nvidia/nemotron-mini-4b-instruct',
  'nvidia/nvidia-nemotron-nano-3b-v2',
  'meta/llama-3.2-3b-instruct',
  'google/gemma-3n-e2b-it',
  'google/gemma-2-2b-it',
  'meta/llama-3.2-1b-instruct',
  'meta/llama-4-maverick-17b-128e-instruct',
  'openai/gpt-oss-120b',
  'deepseek-ai/deepseek-v3.1',
  'moonshotai/kimi-k2-instruct',
  'qwen/qwen3-coder-480b-a35b-instruct',
  'abacusai/dracarys-llama-3.1-70b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.3-70b-instruct',
  'mistralai/mistral-nemotron',
  'nvidia/llama-3.3-nemotron-super-49b-v1.5',
  'qwen/qwen2.5-coder-32b-instruct',
  'mistralai/magistral-small-2506',
  'mistralai/mistral-medium-3-instruct',
  'microsoft/phi-4-multimodal-instruct',
  'meta/llama-3.2-11b-vision-instruct',
  'sarvamai/sarvam-m',
  'z-ai/glm4.7',
  'meta/llama-3.1-8b-instruct',
  'meta/llama3-8b-instruct'
);

-- Active NVIDIA models
insert into public.ai_api_models (priority, name, provider, active, max_tokens_limit, notes)
values
  (1, 'nvidia/llama-3.1-nemotron-70b-instruct', 'nvidia', true, 4096, 'NVIDIA Nemotron 70B'),
  (2, 'meta/llama-3.2-90b-vision-instruct', 'nvidia', true, 4096, 'Meta Llama 3.2 90B Vision'),
  (3, 'mistralai/mistral-7b-instruct-v0.3', 'nvidia', true, 4096, 'Mistral 7B Instruct v0.3'),
  (4, 'google/deplot', 'nvidia', true, 4096, 'Google DePlot')
on conflict (name) do update set
  priority = excluded.priority,
  provider = excluded.provider,
  active = excluded.active,
  notes = excluded.notes;

-- Deactivate discontinued OpenRouter models
update public.ai_api_models
set active = false
where provider = 'openrouter' and name in (
  'openai/gpt-oss-120b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-3-27b-it:free',
  'openai/gpt-oss-20b:free',
  'qwen/qwen3-coder:free',
  'google/gemma-3-12b-it:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'z-ai/glm-4.5-air:free',
  'google/gemma-3-4b-it:free',
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'google/gemma-3n-e4b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'google/gemma-3n-e2b-it:free',
  'nvidia/llama-nemotron-embed-vl-1b-v2:free'
);

-- Active OpenRouter models
insert into public.ai_api_models (priority, name, provider, active, max_tokens_limit, notes)
values
  (1, 'openrouter/free', 'openrouter', true, 4096, 'Universal Free Router'),
  (2, 'google/gemma-4-26b-a4b-it:free', 'openrouter', true, 4096, 'Google Gemma 4 26B'),
  (3, 'nvidia/nemotron-3.5-lightning:free', 'openrouter', true, 4096, 'NVIDIA Nemotron 3.5 Lightning'),
  (4, 'nvidia/nemotron-3.5-super-vl:free', 'openrouter', true, 4096, 'NVIDIA Nemotron 3.5 Super VL'),
  (5, 'nvidia/nemotron-3-ultra-550b-a55b:free', 'openrouter', true, 4096, 'NVIDIA Nemotron 3 Ultra 550B'),
  (6, 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', 'openrouter', true, 4096, 'NVIDIA Nemotron 3 Nano Omni'),
  (7, 'liquid/lfm-2.5-2.6b:free', 'openrouter', true, 4096, 'LiquidAI LFM 2.5'),
  (8, 'cohere/north-mini-code:free', 'openrouter', true, 4096, 'Cohere North Mini Code'),
  (9, 'recursive/flint-v1.0:free', 'openrouter', true, 4096, 'Recursive Flint')
on conflict (name) do update set
  priority = excluded.priority,
  provider = excluded.provider,
  active = excluded.active,
  notes = excluded.notes;
