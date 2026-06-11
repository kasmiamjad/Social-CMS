/**
 * LLM gateway client.
 *
 * Supports THREE providers via a single function:
 *   1. OpenAI (key starts with sk-* but not sk-or-, sk-ant-)
 *   2. OpenRouter (key starts with sk-or-)
 *   3. Anthropic Claude (key starts with sk-ant-)
 *
 * Provider is auto-detected from the API key format. You can override with
 * the LLM_API_URL env var.
 *
 * Env vars (any of these work):
 *   - OPENAI_API_KEY        (preferred for OpenAI)
 *   - OPENROUTER_API_KEY    (preferred for OpenRouter)
 *   - ANTHROPIC_API_KEY     (preferred for Claude — fastest for chat workloads)
 *   - LLM_API_URL           (force endpoint URL — optional)
 *   - OPENROUTER_CLAUDE_MODEL / LLM_MODEL (default model name)
 *
 * Function name `generateOpenRouterJsonResponse` is kept for backwards compat
 * with all existing callers. It now works for any of the three providers.
 */

export interface OpenRouterChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterJsonCompletionParams {
  model: string;
  systemPrompt: string;
  userMessage: string;
  apiKey?: string;
  /** Optional prior conversation turns. Oldest first → newest last. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

interface OpenRouterChoice {
  message?: {
    content?: string;
  };
}

interface OpenRouterCompletionResponse {
  choices?: OpenRouterChoice[];
  error?: {
    message?: string;
  };
}

interface AnthropicMessagesResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: {
    message?: string;
    type?: string;
  };
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

type Provider = "openai" | "openrouter" | "anthropic";

function detectProvider(apiKey: string): Provider {
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  if (apiKey.startsWith("sk-or-")) return "openrouter";
  return "openai";
}

function resolveApiUrl(provider: Provider): string {
  const override = process.env.LLM_API_URL?.trim();
  if (override) return override;
  if (provider === "anthropic") return ANTHROPIC_URL;
  if (provider === "openrouter") return OPENROUTER_URL;
  return OPENAI_URL;
}

/**
 * Calls the configured LLM provider and parses a strict JSON payload.
 * Same signature for all three providers — provider auto-detected by API key.
 */
export async function generateOpenRouterJsonResponse<T>(
  params: OpenRouterJsonCompletionParams
): Promise<T> {
  const apiKey =
    params.apiKey ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing LLM API key. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY in .env.local."
    );
  }

  const provider = detectProvider(apiKey);
  const apiUrl = resolveApiUrl(provider);

  let rawContent: string | undefined;
  let providerLabel: string;

  if (provider === "anthropic") {
    providerLabel = "Anthropic";
    rawContent = await callAnthropic(apiUrl, apiKey, params);
  } else {
    providerLabel = provider === "openrouter" ? "OpenRouter" : "OpenAI";
    rawContent = await callOpenAICompatible(apiUrl, apiKey, params, providerLabel);
  }

  if (!rawContent) {
    throw new Error(`${providerLabel} returned an empty response payload`);
  }

  // Some models wrap JSON in markdown code fences (```json ... ```).
  const jsonContent = rawContent
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(jsonContent) as T;
  } catch (error) {
    throw new Error(
      `${providerLabel} returned non-JSON content: ${
        error instanceof Error ? error.message : "unknown parse error"
      } — raw: ${rawContent.slice(0, 200)}`
    );
  }
}

/**
 * Calls an OpenAI-compatible /chat/completions endpoint (OpenAI itself or OpenRouter).
 */
async function callOpenAICompatible(
  apiUrl: string,
  apiKey: string,
  params: OpenRouterJsonCompletionParams,
  providerLabel: string
): Promise<string | undefined> {
  const messages: OpenRouterChatMessage[] = [
    { role: "system", content: params.systemPrompt },
    ...(params.history ?? []),
    { role: "user", content: params.userMessage },
  ];

  const body = {
    model: params.model,
    messages,
    response_format: { type: "json_object" },
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseData = (await response.json()) as OpenRouterCompletionResponse;
  if (!response.ok) {
    throw new Error(
      responseData.error?.message ??
        `${providerLabel} request failed (HTTP ${response.status})`
    );
  }

  return responseData.choices?.[0]?.message?.content;
}

/**
 * Calls the Anthropic /v1/messages endpoint. Format differs from OpenAI:
 *   - system prompt is a top-level field, not a message
 *   - messages array only contains user/assistant
 *   - response shape uses `content` array of typed blocks
 *   - JSON mode is enforced by instruction (no response_format flag)
 */
async function callAnthropic(
  apiUrl: string,
  apiKey: string,
  params: OpenRouterJsonCompletionParams
): Promise<string | undefined> {
  const messages = [
    ...(params.history ?? []),
    { role: "user" as const, content: params.userMessage },
  ];

  const body = {
    model: params.model,
    max_tokens: 1024,
    system: params.systemPrompt,
    messages,
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseData = (await response.json()) as AnthropicMessagesResponse;
  if (!response.ok) {
    throw new Error(
      responseData.error?.message ??
        `Anthropic request failed (HTTP ${response.status})`
    );
  }

  // Anthropic returns content as an array of blocks; for a JSON reply we
  // grab the first text block.
  const textBlock = responseData.content?.find((b) => b.type === "text");
  return textBlock?.text;
}
