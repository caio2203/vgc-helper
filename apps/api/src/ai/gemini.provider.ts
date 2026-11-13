import { ApiError, type Content, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { type LlmAnswer, type LlmProvider, type LlmRequest, LlmUnavailableError } from './llm.js';

/** Tool rounds before the model has to answer with what it has. */
const MAX_TOOL_ROUNDS = 4;
/**
 * Output budget per call. Thinking tokens count toward it: with a small budget the model can
 * spend it all thinking and return no text. The prompt keeps the answer itself short.
 */
const MAX_OUTPUT_TOKENS = 4096;
/** Longest wait for one call. */
const CALL_TIMEOUT_MS = 25_000;
/** Time for the whole answer, fallback included: the Vercel function stops at 60 s. */
const TOTAL_BUDGET_MS = 50_000;
/** Below this, another call would not finish in time. */
const MIN_CALL_MS = 5_000;
/**
 * Statuses Google returns when a model is overloaded or slow (503 "high demand", 504
 * "deadline expired", 500), plus 429: the free quota is counted per model, so the fallback
 * model may still have some.
 */
const RETRY_ON_NEXT_MODEL = new Set([429, 500, 503, 504]);

class Overloaded extends Error {
  constructor(readonly status: number | null) {
    super(`Gemini status ${status ?? 'timeout'}`);
  }
}

/**
 * Google Gemini through the official SDK, with function calling: the model can ask for usage,
 * common sets and legality, which the API answers from the data snapshot. When the main model
 * is overloaded the same conversation goes to the fallback model.
 */
export class GeminiProvider implements LlmProvider {
  private readonly client: GoogleGenAI;
  private readonly models: string[];

  constructor(
    apiKey: string,
    readonly model: string,
    fallbackModel: string | null = null,
    client?: GoogleGenAI,
    private readonly now: () => number = Date.now,
  ) {
    this.client = client ?? new GoogleGenAI({ apiKey });
    this.models = fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model];
  }

  async generate(request: LlmRequest): Promise<LlmAnswer> {
    const deadline = this.now() + TOTAL_BUDGET_MS;
    const failures: string[] = [];
    let quotaOnly = true;
    for (const model of this.models) {
      try {
        return { text: await this.converse(model, request, deadline), model };
      } catch (error) {
        if (!(error instanceof Overloaded)) throw error;
        failures.push(`${model}: ${error.message}`);
        if (error.status !== 429) quotaOnly = false;
      }
    }
    if (quotaOnly)
      throw new LlmUnavailableError('quota', `Gemini quota reached (${failures.join('; ')})`);
    throw new LlmUnavailableError('unavailable', `Gemini overloaded (${failures.join('; ')})`);
  }

  private async converse(model: string, request: LlmRequest, deadline: number): Promise<string> {
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
    };

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const left = deadline - this.now();
      if (left < MIN_CALL_MS) throw new Overloaded(null);
      let response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>;
      try {
        response = await this.client.models.generateContent({
          model,
          contents,
          config: {
            ...(round === MAX_TOOL_ROUNDS ? { ...config, tools: [] } : config),
            httpOptions: { timeout: Math.min(CALL_TIMEOUT_MS, left) },
          },
        });
      } catch (error) {
        if (error instanceof ApiError && RETRY_ON_NEXT_MODEL.has(error.status)) {
          throw new Overloaded(error.status);
        }
        if (isTimeout(error)) throw new Overloaded(null);
        throw new LlmUnavailableError('unavailable', `Gemini failed: ${String(error)}`);
      }

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
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}
