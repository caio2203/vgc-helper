import { ApiError, type GoogleGenAI } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { GeminiProvider } from './gemini.provider.js';
import { LlmUnavailableError } from './llm.js';

type Call = {
  model: string;
  config: Record<string, unknown> & { httpOptions?: { timeout?: number } };
  contents: unknown[];
};
type Reply = Record<string, unknown> | Error;

/** A client that replays canned responses (or throws canned errors) and records each call. */
function fakeClient(replies: Reply[]) {
  const calls: Call[] = [];
  const client = {
    models: {
      generateContent: async (request: Call) => {
        calls.push({ ...request, contents: [...request.contents] });
        const next = replies.shift();
        if (!next) throw new Error('no more replies');
        if (next instanceof Error) throw next;
        return next;
      },
    },
  } as unknown as GoogleGenAI;
  return { client, calls };
}

const text = (t: string): Reply => ({ text: t, candidates: [{ content: {} }] });
const overloaded = () =>
  new ApiError({ status: 503, message: 'This model is currently experiencing high demand.' });

const request = (callTool = (_name: string, _args: Record<string, unknown>): unknown => null) => ({
  system: 'system',
  messages: [{ role: 'user' as const, text: 'Explain my team' }],
  tools: [{ name: 'getUsage', description: 'usage', parameters: { type: 'object' } }],
  callTool,
});

describe('GeminiProvider', () => {
  it('asks for low thinking with room for the answer after it', async () => {
    const { client, calls } = fakeClient([text('Answer')]);
    const provider = new GeminiProvider('unused', 'main', 'lite', client);
    await expect(provider.generate(request())).resolves.toEqual({ text: 'Answer', model: 'main' });
    expect(calls[0]?.config).toMatchObject({
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingLevel: 'LOW' },
      httpOptions: { timeout: 25_000 },
    });
  });

  it('says why when the model spends the budget without writing an answer', async () => {
    const { client } = fakeClient([{ candidates: [{ content: {}, finishReason: 'MAX_TOKENS' }] }]);
    const provider = new GeminiProvider('unused', 'main', 'lite', client);
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
      text('Incineroar is common'),
    ]);
    const provider = new GeminiProvider('unused', 'main', null, client);
    const answer = await provider.generate(
      request((name, args) => {
        asked.push(`${name}:${String(args.species)}`);
        return { usage: 0.4 };
      }),
    );
    expect(answer.text).toBe('Incineroar is common');
    expect(asked).toEqual(['getUsage:incineroar']);
    expect(calls[1]?.contents.at(-1)).toMatchObject({
      role: 'user',
      parts: [{ functionResponse: { name: 'getUsage', response: { result: { usage: 0.4 } } } }],
    });
  });

  it('moves to the fallback model when Google says the main one is overloaded', async () => {
    const { client, calls } = fakeClient([overloaded(), text('From the lite model')]);
    const provider = new GeminiProvider('unused', 'main', 'lite', client);
    await expect(provider.generate(request())).resolves.toEqual({
      text: 'From the lite model',
      model: 'lite',
    });
    expect(calls.map((c) => c.model)).toEqual(['main', 'lite']);
  });

  it('reports the quota only when every model is out of it', async () => {
    const quota = () => new ApiError({ status: 429, message: 'Resource exhausted' });
    const { client } = fakeClient([quota(), quota()]);
    const provider = new GeminiProvider('unused', 'main', 'lite', client);
    await expect(provider.generate(request())).rejects.toMatchObject({ reason: 'quota' });

    const mixed = fakeClient([quota(), overloaded()]);
    const other = new GeminiProvider('unused', 'main', 'lite', mixed.client);
    await expect(other.generate(request())).rejects.toMatchObject({ reason: 'unavailable' });
  });

  it('does not retry a request Google rejects', async () => {
    const bad = new ApiError({ status: 400, message: 'API key not valid' });
    const { client, calls } = fakeClient([bad, text('never')]);
    const provider = new GeminiProvider('unused', 'main', 'lite', client);
    await expect(provider.generate(request())).rejects.toMatchObject({ reason: 'unavailable' });
    expect(calls).toHaveLength(1);
  });

  it('keeps the whole answer within the time the function has', async () => {
    let clock = 0;
    const slow: Reply = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const { client, calls } = fakeClient([slow, text('Late but in time')]);
    const provider = new GeminiProvider('unused', 'main', 'lite', client, () => clock);
    const generate = client.models.generateContent.bind(client.models);
    client.models.generateContent = (async (req: Parameters<typeof generate>[0]) => {
      clock += 40_000; // The main model used 40 of the 50 seconds before timing out.
      return generate(req);
    }) as typeof generate;
    await expect(provider.generate(request())).resolves.toMatchObject({ model: 'lite' });
    // The fallback call only gets what is left of the budget.
    expect(calls[1]?.config.httpOptions?.timeout).toBe(10_000);
  });
});
