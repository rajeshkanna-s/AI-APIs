# AI APIs Console

React + TypeScript + Bootstrap console for managing NVIDIA and OpenRouter chat models through a Supabase Edge Function.

https://aiapiss.netlify.app/

## What is included

- Frontend model selector, token-slot selector, prompt controls, response viewer, and generated curl.
- Model CRUD backed by the new `public.ai_api_models` table.
- Token slot CRUD backed by the new `public.ai_api_token_slots` table. Raw provider tokens are not stored in the browser or database.
- Provider URL storage backed by `public.ai_api_provider_urls`.
- Supabase Edge Function at `supabase/functions/ai-chat` that calls NVIDIA or OpenRouter chat completions APIs.
- Automatic failover: token/auth/quota/billing/rate-limit errors try the next active token slot, and model/unavailable/context errors try the next active model by priority.
- Chat prompts, chat responses, provider payloads, and usage are not saved.

## Local setup

```bash
npm install
npm run dev
```

The project reads:

```bash
VITE_SUPABASE_URL=https://wuvgoqjxvnbihwiijzfb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_XwfSIwlW4c35Ejv4nwG6Dg_LkXaK4Z_
```

These values have frontend-safe defaults in `src/lib/supabase.ts` so static hosts such as Netlify can render the app even when environment variables are not configured.

## Supabase deploy

```bash
npx supabase link --project-ref wuvgoqjxvnbihwiijzfb
npx supabase db push
npx supabase secrets set NVIDIA_API_TOKEN_1="token-value-1" NVIDIA_API_TOKEN_2="token-value-2"
npx supabase secrets set OPENROUTER_API_TOKEN_1="token-value-1" OPENROUTER_API_TOKEN_2="token-value-2"
npx supabase functions deploy ai-chat
```

## NVIDIA curl

```bash
curl --location 'https://wuvgoqjxvnbihwiijzfb.supabase.co/functions/v1/ai-chat' \
--header 'Content-Type: application/json' \
--header 'apikey: YOUR_SUPABASE_PUBLISHABLE_KEY' \
--header 'Authorization: Bearer YOUR_SUPABASE_PUBLISHABLE_KEY' \
--data '{
  "provider": "nvidia",
  "modelName": "moonshotai/kimi-k2-instruct",
  "prompt": "give roadmap for java developer",
  "temperature": 0.2,
  "top_p": 0.7,
  "max_tokens": 1024,
  "attempt_timeout_ms": 10000,
  "stream": false
}'
```

## OpenRouter curl

```bash
curl --location 'https://wuvgoqjxvnbihwiijzfb.supabase.co/functions/v1/ai-chat' \
--header 'Content-Type: application/json' \
--header 'apikey: YOUR_SUPABASE_PUBLISHABLE_KEY' \
--header 'Authorization: Bearer YOUR_SUPABASE_PUBLISHABLE_KEY' \
--data '{
  "provider": "openrouter",
  "modelName": "openai/gpt-oss-120b:free",
  "prompt": "give roadmap for java developer",
  "temperature": 0.2,
  "top_p": 0.7,
  "max_tokens": 1024,
  "attempt_timeout_ms": 10000,
  "stream": false
}'
```

For a specific token slot, send `tokenSlotId` from the `ai_api_token_slots` table.

If the requested model or token fails, the same curl still returns the first successful fallback route. The JSON response includes `fallback.attempts` so you can see which model/token combinations were skipped.

For speed, each provider attempt has `attempt_timeout_ms`. The default curl uses `10000`, so a slow/hung model route fails over quickly. Use a higher value up to `60000` for longer answers.
