import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";

const providerConfigs = {
  nvidia: {
    chatUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    tokenMapSecret: "NVIDIA_API_TOKENS",
    tokenSecretPrefix: "NVIDIA_API_TOKEN",
  },
  openrouter: {
    chatUrl: "https://openrouter.ai/api/v1/chat/completions",
    tokenMapSecret: "OPENROUTER_API_TOKENS",
    tokenSecretPrefix: "OPENROUTER_API_TOKEN",
  },
} as const;

type ProviderKey = keyof typeof providerConfigs;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatRequest = {
  provider?: string;
  modelId?: string;
  modelName?: string;
  tokenSlotId?: string;
  attempt_timeout_ms?: number;
  messages?: ChatMessage[];
  prompt?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
};

type TokenMap = Record<string, string>;

type ModelRow = {
  id: string | null;
  name: string;
  priority: number;
  max_tokens_limit: number | null;
};

type TokenSlotRow = {
  id: string;
  secret_name: string;
  display_name: string;
  priority: number;
};

type AttemptLog = {
  model: string;
  tokenSlot: string;
  status: number | "missing-secret" | "network-error" | "timeout";
  reason: "token" | "model" | "provider" | "network";
  error: string;
};

type ProviderPayload = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string } | string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parseTokens = (value: string | undefined): TokenMap => {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as TokenMap;
    }
  } catch {
    // Fall through to CSV parsing.
  }

  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .reduce<TokenMap>((tokens, token, index) => {
      tokens[`token-${index + 1}`] = token;
      return tokens;
    }, {});
};

const normalizeSecretName = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]+/g, "_");

const resolveProviderToken = (
  provider: ProviderKey,
  secretName: string,
  priority: number,
  tokenMap: TokenMap,
) =>
  Deno.env.get(secretName) ??
  Deno.env.get(normalizeSecretName(secretName)) ??
  Deno.env.get(`${providerConfigs[provider].tokenSecretPrefix}_${priority}`) ??
  tokenMap[secretName];

const getProvider = (value: string | undefined): ProviderKey =>
  value === "openrouter" ? "openrouter" : "nvidia";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const uniqueBy = <T>(rows: T[], getKey: (row: T) => string | null) => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = getKey(row);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const errorText = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as {
    error?: { message?: string } | string;
    message?: string;
    detail?: string;
  };

  if (typeof body.error === "string") return body.error;
  return body.error?.message ?? body.message ?? body.detail ?? fallback;
};

const classifyFailure = (status: number, message: string) => {
  const text = message.toLowerCase();
  const tokenProblem =
    [401, 402, 403, 408, 409, 425, 429].includes(status) ||
    /token|auth|unauthori[sz]ed|forbidden|quota|credit|balance|billing|payment|price|rate limit|too many requests|capacity/.test(
      text,
    );

  if (tokenProblem) return "token" as const;

  const modelProblem =
    [400, 404, 410, 422].includes(status) ||
    /model|not found|unsupported|unavailable|deprecated|does not exist|invalid model|max tokens|context/.test(
      text,
    );

  if (modelProblem) return "model" as const;

  return "provider" as const;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const provider = getProvider(new URL(req.url).searchParams.get("provider") ?? undefined);
    const config = providerConfigs[provider];
    const tokenMap = parseTokens(Deno.env.get(config.tokenMapSecret));
    return jsonResponse({
      ok: true,
      provider,
      chatUrl: config.chatUrl,
      configuredTokenSlots: [
        ...new Set([
          ...Object.keys(tokenMap),
          ...Array.from({ length: 20 }, (_, index) =>
            Deno.env.get(`${config.tokenSecretPrefix}_${index + 1}`)
              ? `${provider}-token-${index + 1}`
              : "",
          ),
        ]),
      ].filter(Boolean),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret" },
      500,
    );
  }

  const body = (await req.json()) as ChatRequest;
  const provider = getProvider(body.provider);
  const config = providerConfigs[provider];
  const tokenMap = parseTokens(Deno.env.get(config.tokenMapSecret));
  const hasNumberedToken = Array.from({ length: 20 }, (_, index) =>
    Deno.env.get(`${config.tokenSecretPrefix}_${index + 1}`),
  ).some(Boolean);

  if (Object.keys(tokenMap).length === 0 && !hasNumberedToken) {
    return jsonResponse(
      {
        error: `Missing ${config.tokenMapSecret} or ${config.tokenSecretPrefix}_N secret`,
      },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const messages =
    body.messages && body.messages.length > 0
      ? body.messages
      : body.prompt
        ? [{ role: "user", content: body.prompt }]
        : [];

  if (messages.length === 0) {
    return jsonResponse({ error: "Send messages[] or prompt" }, 400);
  }

  const modelBaseQuery = () =>
    supabase
      .from("ai_api_models")
      .select("id, name, priority, max_tokens_limit")
      .eq("provider", provider)
      .eq("active", true);

  const tokenBaseQuery = () =>
    supabase
      .from("ai_api_token_slots")
      .select("id, secret_name, display_name, priority")
      .eq("provider", provider)
      .eq("active", true);

  const [
    { data: activeModels, error: modelError },
    { data: activeTokenSlots, error: tokenSlotError },
  ] = await Promise.all([
    modelBaseQuery().order("priority", { ascending: true }),
    tokenBaseQuery().order("priority", { ascending: true }),
  ]);

  if (modelError || !activeModels || activeModels.length === 0) {
    return jsonResponse({ error: "No active model found" }, 404);
  }

  if (
    tokenSlotError ||
    !activeTokenSlots ||
    activeTokenSlots.length === 0
  ) {
    return jsonResponse({ error: "No active token slot found" }, 404);
  }

  const requestedModel = activeModels.find((model) =>
    body.modelId ? model.id === body.modelId : model.name === body.modelName,
  );
  const requestedExternalModel =
    body.modelName && !requestedModel
      ? {
          id: null,
          name: body.modelName,
          priority: 0,
          max_tokens_limit: 4096,
        }
      : null;
  const modelCandidates = uniqueBy<ModelRow>(
    [
      ...(requestedModel ? [requestedModel] : []),
      ...(requestedExternalModel ? [requestedExternalModel] : []),
      ...activeModels,
    ],
    (model) => model.name,
  );

  const requestedTokenSlot = activeTokenSlots.find((slot) =>
    body.tokenSlotId ? slot.id === body.tokenSlotId : false,
  );
  const tokenCandidates = uniqueBy<TokenSlotRow>(
    [...(requestedTokenSlot ? [requestedTokenSlot] : []), ...activeTokenSlots],
    (slot) => slot.id,
  );

  const attempts: AttemptLog[] = [];
  let lastPayload: unknown = null;
  let lastStatus = 500;
  const attemptTimeoutMs = clamp(body.attempt_timeout_ms ?? 25000, 3000, 60000);
  const startedAt = performance.now();

  for (const model of modelCandidates) {
    const maxTokens = Math.min(
      body.max_tokens ?? 1024,
      model.max_tokens_limit ?? 4096,
    );

    const providerPayload = {
      model: model.name,
      messages,
      temperature: body.temperature ?? 0.2,
      top_p: body.top_p ?? 0.7,
      max_tokens: maxTokens,
      stream: body.stream ?? false,
    };

    let moveToNextModel = false;

    for (const tokenSlot of tokenCandidates) {
      const providerToken = resolveProviderToken(
        provider,
        tokenSlot.secret_name,
        tokenSlot.priority,
        tokenMap,
      );

      if (!providerToken) {
        attempts.push({
          model: model.name,
          tokenSlot: tokenSlot.display_name,
          status: "missing-secret",
          reason: "token",
          error: `Secret value not configured for ${tokenSlot.secret_name}`,
        });
        continue;
      }

      let providerResponse: Response;
      let providerJson: ProviderPayload;
      const attemptController = new AbortController();
      const attemptTimer = setTimeout(
        () => attemptController.abort(),
        attemptTimeoutMs,
      );

      try {
        providerResponse = await fetch(config.chatUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${providerToken}`,
            ...(provider === "openrouter"
              ? {
                  "HTTP-Referer": supabaseUrl,
                  "X-Title": "AI APIs Supabase Console",
                }
              : {}),
          },
          body: JSON.stringify(providerPayload),
          signal: attemptController.signal,
        });
      } catch (error) {
        const timedOut =
          error instanceof DOMException && error.name === "AbortError";
        const message = timedOut
          ? `Attempt timed out after ${attemptTimeoutMs}ms`
          : error instanceof Error
            ? error.message
            : "Provider network error";
        attempts.push({
          model: model.name,
          tokenSlot: tokenSlot.display_name,
          status: timedOut ? "timeout" : "network-error",
          reason: timedOut ? "model" : "network",
          error: message,
        });
        lastPayload = { error: message };
        lastStatus = 502;
        clearTimeout(attemptTimer);
        if (timedOut) {
          moveToNextModel = true;
          break;
        }
        continue;
      } finally {
        clearTimeout(attemptTimer);
      }

      const providerText = await providerResponse.text();
      try {
        providerJson = JSON.parse(providerText) as ProviderPayload;
      } catch {
        providerJson = {
          error: {
            message: providerText || providerResponse.statusText,
          },
        };
      }

      lastPayload = providerJson;
      lastStatus = providerResponse.status;

      const assistantText =
        providerJson?.choices?.[0]?.message?.content ??
        providerJson?.error?.message ??
        "";

      if (providerResponse.ok) {
        return jsonResponse({
          provider,
          model: model.name,
          tokenSlot: tokenSlot.display_name,
          content: assistantText,
          usage: providerJson?.usage ?? null,
          fallback: {
            attempted: attempts.length + 1,
            latencyMs: Math.round(performance.now() - startedAt),
            attemptTimeoutMs,
            switchedModel:
              Boolean(body.modelId || body.modelName) &&
              model.name !== (body.modelName ?? requestedModel?.name),
            switchedToken:
              Boolean(body.tokenSlotId) && tokenSlot.id !== body.tokenSlotId,
            attempts,
          },
        });
      }

      const failureReason = classifyFailure(
        providerResponse.status,
        errorText(providerJson, providerResponse.statusText),
      );
      attempts.push({
        model: model.name,
        tokenSlot: tokenSlot.display_name,
        status: providerResponse.status,
        reason: failureReason,
        error: errorText(providerJson, providerResponse.statusText),
      });

      if (failureReason === "model") {
        moveToNextModel = true;
        break;
      }
    }

    if (moveToNextModel) continue;
  }

  return jsonResponse(
    {
      error:
        errorText(lastPayload, "All model and token fallback attempts failed") ??
        "All model and token fallback attempts failed",
      providerStatus: lastStatus,
      fallback: {
        attempted: attempts.length,
        latencyMs: Math.round(performance.now() - startedAt),
        attemptTimeoutMs,
        attempts,
      },
    },
    lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502,
  );
});
