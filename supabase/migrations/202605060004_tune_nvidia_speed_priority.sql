update public.ai_api_models
set priority = case name
  when 'meta/llama-4-maverick-17b-128e-instruct' then 1
  when 'openai/gpt-oss-120b' then 2
  when 'deepseek-ai/deepseek-v3.1' then 3
  when 'moonshotai/kimi-k2-instruct' then 4
  when 'qwen/qwen3-coder-480b-a35b-instruct' then 5
  else priority + 10
end
where provider = 'nvidia';
