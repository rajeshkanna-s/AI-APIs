import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CustomToken = {
  name: string;
  value: string;
  priority: number;
  active?: boolean;
};

type CustomModel = {
  name: string;
  priority: number;
  active?: boolean;
};

type CreateRequest = {
  name: string;
  endpointUrl: string;
  method?: string;
  authHeaderName?: string;
  authPrefix?: string;
  tokens: CustomToken[];
  models: CustomModel[];
  sampleCurl?: string;
  inputSample?: unknown;
  outputSample?: unknown;
  requestBodyTemplate?: Record<string, unknown>;
  extraHeaders?: Record<string, string>;
  maxLoops?: number;
};

type InvokeRequest = {
  messages?: ChatMessage[];
  prompt?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  attempt_timeout_ms?: number;
  extra?: Record<string, unknown>;
};

type BuildRow = {
  name: string;
  slug: string;
  endpoint_url: string;
  method: string;
  auth_header_name: string;
  auth_prefix: string | null;
  access_token_hash: string;
  tokens: CustomToken[];
  models: CustomModel[];
  request_body_template: Record<string, unknown> | null;
  extra_headers: Record<string, string> | null;
  max_loops: number;
};

type ProviderPayload = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string } | string;
  message?: string;
  usage?: unknown;
};

type Attempt = {
  loop: number;
  model: string;
  token: string;
  status: number | "network-error" | "timeout";
  reason: "token" | "model" | "provider" | "network";
  error: string;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "custom-api";

const randomToken = (prefix: string) => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
};

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

const parseJsonish = (value: unknown) => {
  if (!value || typeof value !== "string") return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return { text: value };
  }
};

const errorText = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") return fallback;
  const body = payload as ProviderPayload;
  if (typeof body.error === "string") return body.error;
  return body.error?.message ?? body.message ?? fallback;
};

const classifyFailure = (status: number, message: string) => {
  const text = message.toLowerCase();
  if (
    [401, 402, 403, 408, 409, 425, 429].includes(status) ||
    /token|auth|key|unauthori[sz]ed|forbidden|quota|credit|balance|billing|payment|price|rate limit|too many requests|capacity/.test(
      text,
    )
  ) {
    return "token" as const;
  }

  if (
    [400, 404, 410, 422].includes(status) ||
    /model|not found|unsupported|unavailable|deprecated|does not exist|invalid model|max tokens|context/.test(
      text,
    )
  ) {
    return "model" as const;
  }

  return "provider" as const;
};

const getSupabase = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret");
  }

  return {
    supabaseUrl,
    supabase: createClient(supabaseUrl, serviceRoleKey),
  };
};

const normalizeTokens = (tokens: CustomToken[]) =>
  tokens
    .slice(0, 20)
    .map((token, index) => ({
      name: token.name || `Token ${index + 1}`,
      value: token.value,
      priority: Number(token.priority || index + 1),
      active: token.active !== false,
    }))
    .filter((token) => token.value)
    .sort((a, b) => a.priority - b.priority);

const normalizeModels = (models: CustomModel[]) =>
  models
    .slice(0, 50)
    .map((model, index) => ({
      name: model.name,
      priority: Number(model.priority || index + 1),
      active: model.active !== false,
    }))
    .filter((model) => model.name)
    .sort((a, b) => a.priority - b.priority);

const createBuild = async (req: Request) => {
  const { supabaseUrl, supabase } = getSupabase();
  const body = (await req.json()) as CreateRequest;
  const tokens = normalizeTokens(body.tokens ?? []);
  const models = normalizeModels(body.models ?? []);

  if (!body.name?.trim()) return jsonResponse({ error: "Name is required" }, 400);
  if (!body.endpointUrl?.trim()) {
    return jsonResponse({ error: "Endpoint URL is required" }, 400);
  }
  if (tokens.length === 0) {
    return jsonResponse({ error: "At least one token is required" }, 400);
  }
  if (models.length === 0) {
    return jsonResponse({ error: "At least one model is required" }, 400);
  }

  const slug = `${slugify(body.name)}-${randomToken("id").slice(-8)}`;
  const accessToken = randomToken("cap");
  const accessTokenHash = await sha256(accessToken);

  const { error } = await supabase.from("ai_api_custom_builds").insert({
    name: body.name.trim(),
    slug,
    endpoint_url: body.endpointUrl.trim(),
    method: (body.method || "POST").toUpperCase(),
    auth_header_name: body.authHeaderName || "Authorization",
    auth_prefix: body.authPrefix ?? "Bearer",
    access_token_hash: accessTokenHash,
    tokens,
    models,
    sample_curl: body.sampleCurl || null,
    input_sample: parseJsonish(body.inputSample),
    output_sample: parseJsonish(body.outputSample),
    request_body_template: body.requestBodyTemplate ?? null,
    extra_headers: body.extraHeaders ?? {},
    max_loops: clamp(body.maxLoops ?? 2, 1, 2),
  });

  if (error) return jsonResponse({ error: error.message }, 500);

  const apiUrl = `${supabaseUrl}/functions/v1/custom-api/${slug}`;
  const curl = `curl --location '${apiUrl}' \\
--header 'Content-Type: application/json' \\
--header 'Authorization: Bearer ${accessToken}' \\
--data '{
  "prompt": "give roadmap for java developer",
  "temperature": 0.2,
  "top_p": 0.7,
  "max_tokens": 1024,
  "stream": false
}'`;

  return jsonResponse({
    name: body.name.trim(),
    slug,
    apiUrl,
    accessToken,
    curl,
    limits: {
      tokens: tokens.length,
      models: models.length,
      maxLoops: clamp(body.maxLoops ?? 2, 1, 2),
    },
  });
};

const invokeBuild = async (req: Request, slug: string) => {
  const { supabase } = getSupabase();
  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken =
    authHeader.replace(/^Bearer\s+/i, "") || req.headers.get("x-api-key") || "";

  if (!accessToken) return jsonResponse({ error: "Missing API token" }, 401);

  const { data: build, error } = await supabase
    .from("ai_api_custom_builds")
    .select(
      "name, slug, endpoint_url, method, auth_header_name, auth_prefix, access_token_hash, tokens, models, request_body_template, extra_headers, max_loops",
    )
    .eq("slug", slug)
    .eq("active", true)
    .single<BuildRow>();

  if (error || !build) return jsonResponse({ error: "Custom API not found" }, 404);

  if ((await sha256(accessToken)) !== build.access_token_hash) {
    return jsonResponse({ error: "Invalid API token" }, 401);
  }

  const body = (await req.json()) as InvokeRequest;
  const messages =
    body.messages && body.messages.length > 0
      ? body.messages
      : body.prompt
        ? [{ role: "user", content: body.prompt }]
        : [];

  if (messages.length === 0) {
    return jsonResponse({ error: "Send messages[] or prompt" }, 400);
  }

  const tokens = normalizeTokens(build.tokens);
  const models = normalizeModels(build.models);
  const maxLoops = clamp(build.max_loops ?? 2, 1, 2);
  const attemptTimeoutMs = clamp(body.attempt_timeout_ms ?? 10000, 3000, 60000);
  const attempts: Attempt[] = [];
  const startedAt = performance.now();
  let lastPayload: unknown = null;
  let lastStatus = 502;

  for (let loop = 1; loop <= maxLoops; loop += 1) {
    for (const model of models) {
      let moveToNextModel = false;

      for (const token of tokens) {
        const requestBody = {
          ...(build.request_body_template ?? {}),
          ...(body.extra ?? {}),
          model: model.name,
          messages,
          temperature: body.temperature ?? 0.2,
          top_p: body.top_p ?? 0.7,
          max_tokens: body.max_tokens ?? 1024,
          stream: body.stream ?? false,
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), attemptTimeoutMs);
        let response: Response;
        let payload: ProviderPayload;

        try {
          response = await fetch(build.endpoint_url, {
            method: build.method || "POST",
            headers: {
              "Content-Type": "application/json",
              ...(build.extra_headers ?? {}),
              [build.auth_header_name || "Authorization"]: build.auth_prefix
                ? `${build.auth_prefix} ${token.value}`
                : token.value,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
        } catch (requestError) {
          const timedOut =
            requestError instanceof DOMException &&
            requestError.name === "AbortError";
          const message = timedOut
            ? `Attempt timed out after ${attemptTimeoutMs}ms`
            : requestError instanceof Error
              ? requestError.message
              : "Provider network error";
          attempts.push({
            loop,
            model: model.name,
            token: token.name,
            status: timedOut ? "timeout" : "network-error",
            reason: timedOut ? "model" : "network",
            error: message,
          });
          clearTimeout(timer);
          lastPayload = { error: message };
          lastStatus = 502;
          if (timedOut) {
            moveToNextModel = true;
            break;
          }
          continue;
        } finally {
          clearTimeout(timer);
        }

        const responseText = await response.text();
        try {
          payload = JSON.parse(responseText) as ProviderPayload;
        } catch {
          payload = { error: { message: responseText || response.statusText } };
        }

        lastPayload = payload;
        lastStatus = response.status;

        if (response.ok) {
          const content =
            payload.choices?.[0]?.message?.content ??
            errorText(payload, "Provider returned no content");

          return jsonResponse({
            customApi: build.name,
            model: model.name,
            token: token.name,
            content,
            usage: payload.usage ?? null,
            fallback: {
              attempted: attempts.length + 1,
              loop,
              maxLoops,
              latencyMs: Math.round(performance.now() - startedAt),
              attemptTimeoutMs,
              attempts,
            },
          });
        }

        const reason = classifyFailure(response.status, errorText(payload, response.statusText));
        attempts.push({
          loop,
          model: model.name,
          token: token.name,
          status: response.status,
          reason,
          error: errorText(payload, response.statusText),
        });

        if (reason === "model") {
          moveToNextModel = true;
          break;
        }
      }

      if (moveToNextModel) continue;
    }
  }

  return jsonResponse(
    {
      error: errorText(lastPayload, "All custom API attempts failed"),
      providerStatus: lastStatus,
      fallback: {
        attempted: attempts.length,
        maxLoops,
        latencyMs: Math.round(performance.now() - startedAt),
        attemptTimeoutMs,
        attempts,
      },
    },
    lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502,
  );
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const action = parts.at(-1);

    if (req.method === "POST" && action === "create") {
      return await createBuild(req);
    }

    if (req.method === "POST" && action) {
      return await invokeBuild(req, action);
    }

    return jsonResponse({
      ok: true,
      createUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/custom-api/create`,
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Custom API failed" },
      500,
    );
  }
});
