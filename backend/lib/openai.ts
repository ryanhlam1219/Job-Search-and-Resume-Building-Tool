import OpenAI from "openai";

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

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

export async function callOpenAI<T>(
  systemPrompt: string,
  userContent: string,
  retries = 2
): Promise<T> {
  const client = getOpenAI();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: OLLAMA_MODEL,
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
      // Strip markdown code fences some models add despite json_object mode
      const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      return JSON.parse(cleaned) as T;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error("Ollama call failed after retries");
}

/** Chat variant — returns plain text (not JSON). Use for conversational turns. */
export async function callOpenAIChat(
  systemPrompt: string,
  userContent: string,
  retries = 2
): Promise<string> {
  const client = getOpenAI();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: OLLAMA_MODEL,
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
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error("Ollama chat call failed after retries");
}
