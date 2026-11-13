import { ApiError, type Content, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { type LlmProvider, type LlmRequest, LlmUnavailableError } from './llm.js';

/** Tool rounds before the model has to answer with what it has. */
const MAX_TOOL_ROUNDS = 4;
/**
 * Output budget per call. Thinking tokens count toward it: with a small budget the model can
 * spend it all thinking and return no text. The prompt keeps the answer itself short.
 */
const MAX_OUTPUT_TOKENS = 4096;
const TIMEOUT_MS = 25_000;

/**
 * Google Gemini through the official SDK, with function calling: the model can ask for usage,
 * common sets and legality, which the API answers from the data snapshot.
 */
export class GeminiProvider implements LlmProvider {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    client?: GoogleGenAI,
  ) {
    this.client = client ?? new GoogleGenAI({ apiKey });
  }

  async generate(request: LlmRequest): Promise<string> {
    const contents: Content[] = request.messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));
    const config = {
      systemInstruction: request.system,
      temperature: 0.3,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      // The answer explains data the API already computed: little reasoning, less quota.
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      tools: [
        {
          functionDeclarations: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parametersJsonSchema: t.parameters,
          })),
        },
      ],
      httpOptions: { timeout: TIMEOUT_MS },
    };

    try {
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents,
          config: round === MAX_TOOL_ROUNDS ? { ...config, tools: [] } : config,
        });
        const calls = response.functionCalls ?? [];
        const answer = response.candidates?.[0]?.content;
        if (calls.length === 0 || !answer) {
          const text = response.text?.trim();
          if (!text) {
            const finish = response.candidates?.[0]?.finishReason ?? 'unknown';
            throw new LlmUnavailableError('unavailable', `The model returned no text (${finish})`);
          }
          return text;
        }
        contents.push(answer);
        contents.push({
          role: 'user',
          parts: calls.map((call) => ({
            functionResponse: {
              id: call.id,
              name: call.name,
              response: { result: request.callTool(call.name ?? '', call.args ?? {}) },
            },
          })),
        });
      }
      throw new LlmUnavailableError('unavailable', 'Too many tool rounds');
    } catch (error) {
      if (error instanceof LlmUnavailableError) throw error;
      if (error instanceof ApiError && error.status === 429) {
        throw new LlmUnavailableError('quota', 'Gemini quota reached');
      }
      throw new LlmUnavailableError('unavailable', `Gemini failed: ${String(error)}`);
    }
  }
}
