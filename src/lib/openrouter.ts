/**
 * LLM gateway client.
 *
 * Supports BOTH OpenAI and OpenRouter using the same OpenAI-compatible
 * chat-completions contract. Auto-detects the provider from the API key
 * format, OR you can force it with the LLM_API_URL env var.
 *
 * Provider detection:
 *   - sk-or-*  → OpenRouter
 *   - sk-*     → OpenAI (default if format is ambiguous)
 *
 * Env vars (any of these work):
 *   - OPENAI_API_KEY        (preferred for OpenAI)
 *   - OPENROUTER_API_KEY    (preferred for OpenRouter)
 *   - LLM_API_URL           (override the endpoint URL — optional)
 *   - OPENROUTER_CLAUDE_MODEL / LLM_MODEL (default model name)
 *
 * The legacy function name `generateOpenRouterJsonResponse` is kept so existing
 * services don't need to change. It works equally well for OpenAI now.
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

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Resolves which API URL to call based on env var override OR API key prefix.
 *   - sk-or-*  → OpenRouter URL
 *   - other sk-* keys → OpenAI URL
 *   - LLM_API_URL env var ALWAYS wins if set
 */
function resolveApiUrl(apiKey: string): string {
  const override = process.env.LLM_API_URL?.trim();
  if (override) return override;
  if (apiKey.startsWith("sk-or-")) return OPENROUTER_URL;
  return OPENAI_URL;
}

/**
 * Calls the LLM (OpenAI or OpenRouter) chat-completions endpoint and parses
 * a strict JSON payload. Kept under the legacy name for backwards compat.
 */
export async function generateOpenRouterJsonResponse<T>(
  params: OpenRouterJsonCompletionParams
): Promise<T> {
  // Priority: explicit param → OPENAI_API_KEY → OPENROUTER_API_KEY
  const apiKey =
    params.apiKey ??
    process.env.OPENAI_API_KEY ??
    process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing LLM API key. Set OPENAI_API_KEY or OPENROUTER_API_KEY in .env.local."
    );
  }

  const apiUrl = resolveApiUrl(apiKey);
  const providerLabel = apiUrl.includes("openai.com") ? "OpenAI" : "OpenRouter";

  const body = {
    model: params.model,
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userMessage },
    ] as OpenRouterChatMessage[],
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

  const rawContent = responseData.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error(`${providerLabel} returned an empty response payload`);
  }

  // Some models wrap JSON in markdown code fences (```json ... ```).
  // Strip them before parsing so we never fail on well-formed content.
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
      }`
    );
  }
}
