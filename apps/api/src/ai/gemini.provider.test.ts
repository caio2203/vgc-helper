import type { GoogleGenAI } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { GeminiProvider } from './gemini.provider.js';
import { LlmUnavailableError } from './llm.js';

type Call = { config: Record<string, unknown>; contents: unknown[] };

/** A client that replays canned responses and records what it was sent. */
function fakeClient(responses: Record<string, unknown>[]) {
  const calls: Call[] = [];
  const client = {
    models: {
      generateContent: async (request: Call) => {
        calls.push({ config: request.config, contents: [...request.contents] });
        const next = responses.shift();
        if (!next) throw new Error('no more responses');
        return next;
      },
    },
  } as unknown as GoogleGenAI;
  return { client, calls };
}

const request = (callTool = (_name: string, _args: Record<string, unknown>): unknown => null) => ({
  system: 'system',
  messages: [{ role: 'user' as const, text: 'Explain my team' }],
  tools: [{ name: 'getUsage', description: 'usage', parameters: { type: 'object' } }],
  callTool,
});

describe('GeminiProvider', () => {
  it('asks for low thinking with room for the answer after it', async () => {
    const { client, calls } = fakeClient([{ text: 'Answer', candidates: [{ content: {} }] }]);
    const provider = new GeminiProvider('unused', 'gemini-test', client);
    await expect(provider.generate(request())).resolves.toBe('Answer');
    expect(calls[0]?.config).toMatchObject({
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingLevel: 'LOW' },
    });
  });

  it('says why when the model spends the budget without writing an answer', async () => {
    const { client } = fakeClient([{ candidates: [{ content: {}, finishReason: 'MAX_TOKENS' }] }]);
    const provider = new GeminiProvider('unused', 'gemini-test', client);
    const error = await provider.generate(request()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmUnavailableError);
    expect(error).toMatchObject({ reason: 'unavailable' });
    expect((error as Error).message).toContain('MAX_TOKENS');
  });

  it('answers tool calls from the data and sends the results back', async () => {
    const asked: string[] = [];
    const { client, calls } = fakeClient([
      {
        functionCalls: [{ id: '1', name: 'getUsage', args: { species: 'incineroar' } }],
        candidates: [
          { content: { role: 'model', parts: [{ functionCall: { name: 'getUsage' } }] } },
        ],
      },
      { text: 'Incineroar is common', candidates: [{ content: {} }] },
    ]);
    const provider = new GeminiProvider('unused', 'gemini-test', client);
    const answer = await provider.generate(
      request((name, args) => {
        asked.push(`${name}:${String(args.species)}`);
        return { usage: 0.4 };
      }),
    );
    expect(answer).toBe('Incineroar is common');
    expect(asked).toEqual(['getUsage:incineroar']);
    expect(calls[1]?.contents.at(-1)).toMatchObject({
      role: 'user',
      parts: [{ functionResponse: { name: 'getUsage', response: { result: { usage: 0.4 } } } }],
    });
  });
});
