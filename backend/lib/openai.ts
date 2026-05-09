import OpenAI from "openai";

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";
// If the primary model is a cloud model and hits a quota/auth error (403/429),
// fall back to the local llama3.2 model which is always available offline.
const FALLBACK_MODEL = "llama3.2";

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_client) {
    // Ollama exposes an OpenAI-compatible REST API — no real key needed.
    _client = new OpenAI({
      baseURL: OLLAMA_BASE_URL,
      apiKey: "ollama",
    });
  }
  return _client;
}

/** Returns true for HTTP errors that indicate a cloud quota or auth problem. */
function isCloudLimitError(err: unknown): boolean {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status: number }).status;
    return status === 403 || status === 429;
  }
  return false;
}

export async function callOpenAI<T>(
  systemPrompt: string,
  userContent: string,
  retries = 2
): Promise<T> {
  const client = getOpenAI();
  const isCloudModel = OLLAMA_MODEL !== FALLBACK_MODEL && OLLAMA_MODEL.endsWith(":cloud");

  const tryModel = async (model: string): Promise<T> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          // Ollama supports the response_format hint for JSON mode
          response_format: { type: "json_object" },
          temperature: 0.1,
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("Empty response from Ollama");
        // Strip markdown code fences — models often wrap JSON in ```json ... ``` blocks
        const cleaned = content
          .replace(/^[\s\S]*?```(?:json)?\s*/i, "")
          .replace(/\s*```[\s\S]*$/i, "")
          .trim();
        const toParse = cleaned.startsWith("{") || cleaned.startsWith("[") ? cleaned : content.trim();
        return JSON.parse(toParse) as T;
      } catch (err) {
        if (isCloudLimitError(err)) throw err; // propagate immediately — caller handles fallback
        if (attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    throw new Error("Ollama call failed after retries");
  };

  try {
    return await tryModel(OLLAMA_MODEL);
  } catch (err) {
    if (isCloudModel && isCloudLimitError(err)) {
      console.warn(`[ollama] Cloud model '${OLLAMA_MODEL}' returned ${(err as {status:number}).status} — falling back to '${FALLBACK_MODEL}'`);
      return await tryModel(FALLBACK_MODEL);
    }
    throw err;
  }
}

/** Chat variant — returns plain text (not JSON). Use for conversational turns. */
export async function callOpenAIChat(
  systemPrompt: string,
  userContent: string,
  retries = 2
): Promise<string> {
  const client = getOpenAI();
  const isCloudModel = OLLAMA_MODEL !== FALLBACK_MODEL && OLLAMA_MODEL.endsWith(":cloud");

  const tryModel = async (model: string): Promise<string> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.4,
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("Empty response from Ollama");
        return content;
      } catch (err) {
        if (isCloudLimitError(err)) throw err;
        if (attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    throw new Error("Ollama chat call failed after retries");
  };

  try {
    return await tryModel(OLLAMA_MODEL);
  } catch (err) {
    if (isCloudModel && isCloudLimitError(err)) {
      console.warn(`[ollama] Cloud model '${OLLAMA_MODEL}' returned ${(err as {status:number}).status} — falling back to '${FALLBACK_MODEL}'`);
      return await tryModel(FALLBACK_MODEL);
    }
    throw err;
  }
}
