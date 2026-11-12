/**
 * The language model behind the AI features, kept behind this interface so the provider can
 * change (or be faked in tests) without touching the rest of the API.
 */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmTool {
  name: string;
  description: string;
  /** JSON Schema (OpenAPI subset) of the arguments. */
  parameters: Record<string, unknown>;
}

export interface LlmRequest {
  system: string;
  messages: { role: 'user' | 'model'; text: string }[];
  tools: LlmTool[];
  /** Runs a tool the model asked for; the result goes back to the model as JSON. */
  callTool: (name: string, args: Record<string, unknown>) => unknown;
}

export interface LlmProvider {
  readonly model: string;
  generate(request: LlmRequest): Promise<string>;
}

/** The provider could not answer: out of quota, or any other failure. The app falls back. */
export class LlmUnavailableError extends Error {
  override name = 'LlmUnavailableError';
  constructor(
    readonly reason: 'quota' | 'unavailable',
    message: string,
  ) {
    super(message);
  }
}
