import { LLMResult } from "@langchain/core/outputs";
import { Ratelimit, Response } from '@upstash/ratelimit';
import { Serialized } from "./langchain-core/src/load/serializable";
import { UpstashRatelimitHandler, UpstashRatelimitError } from '../handlers/upstash_ratelimit.js';


// Mocked Ratelimit class
jest.mock('@upstash/ratelimit');

const createRatelimitMock = () => {
  const ratelimit = new Ratelimit();
  (ratelimit.limit as jest.Mock).mockReturnValue(Promise.resolve(new Response(true, 10, 10, 10000)));
  (ratelimit.getRemaining as jest.Mock).mockReturnValue(Promise.resolve(1000));
  return ratelimit;
};

const serialized: Serialized = {
  lc: 1,
  type: "constructor",
  id: ["test"],
  kwargs: {},
};


describe('UpstashRatelimitHandler', () => {
  let requestRatelimit: Ratelimit;
  let tokenRatelimit: Ratelimit;
  let handlerWithBothLimits: UpstashRatelimitHandler;

  beforeEach(() => {
    requestRatelimit = createRatelimitMock();
    tokenRatelimit = createRatelimitMock();
    handlerWithBothLimits = new UpstashRatelimitHandler('user123', {
      tokenRatelimit,
      requestRatelimit,
      includeOutputTokens: false,
    });
  });

  test('should throw error if no limits are provided', () => {
    expect(() => new UpstashRatelimitHandler('user123', {})).toThrowError('You must pass at least one of tokenRatelimit or requestRatelimit.');
  });

  test('should initialize with request limit only', () => {
    const handler = new UpstashRatelimitHandler('user123', { requestRatelimit });
    expect(handler.requestRatelimit).toBeDefined();
    expect(handler.tokenRatelimit).toBeUndefined();
  });

  test('should initialize with token limit only', () => {
    const handler = new UpstashRatelimitHandler('user123', { tokenRatelimit });
    expect(handler.tokenRatelimit).toBeDefined();
    expect(handler.requestRatelimit).toBeUndefined();
  });

  test('should handle chain start with request limit', async () => {
    await handlerWithBothLimits.handleChainStart(serialized, {});
    expect(requestRatelimit.limit).toHaveBeenCalledWith('user123');
    expect(tokenRatelimit.limit).not.toHaveBeenCalled();
  });

  test('should throw error when request limit is reached', async () => {
    (requestRatelimit.limit as jest.Mock).mockReturnValue(Promise.resolve(new Response(false, 10, 0, 10000)));
    const handler = new UpstashRatelimitHandler('user123', { requestRatelimit });
    await expect(handler.handleChainStart(serialized, {})).rejects.toThrowError(UpstashRatelimitError);
  });

  test('should throw error when token limit is reached', async () => {
    (tokenRatelimit.getRemaining as jest.Mock).mockReturnValue(Promise.resolve(0));
    const handler = new UpstashRatelimitHandler('user123', { tokenRatelimit });
    await expect(handler.handleLLMStart(serialized, ['test'], 'runId')).rejects.toThrowError(UpstashRatelimitError);
  });

  test('should handle LLM end with token limit', async () => {
    const response: LLMResult = {
      generations: [],
      llmOutput: {
        token_usage: {
          prompt_tokens: 2,
          completion_tokens: 3,
          total_tokens: 5,
        },
      },
    };
    await handlerWithBothLimits.handleLLMEnd(response, 'runId');
    expect(tokenRatelimit.limit).toHaveBeenCalledWith('user123', 2);
  });

  test('should handle LLM end with token limit including output tokens', async () => {
    const handler = new UpstashRatelimitHandler('user123', {
      tokenRatelimit,
      includeOutputTokens: true,
    });
    const response: LLMResult = {
      generations: [],
      llmOutput: {
        token_usage: {
          prompt_tokens: 2,
          completion_tokens: 3,
          total_tokens: 5,
        },
      },
    };
    await handler.handleLLMEnd(response, 'runId');
    expect(tokenRatelimit.limit).toHaveBeenCalledWith('user123', 5);
  });

  test('should throw error when LLM response does not include token usage', async () => {
    const response: LLMResult = {
      generations: [],
      llmOutput: {},
    };
    await expect(handlerWithBothLimits.handleLLMEnd(response, 'runId')).rejects.toThrowError('LLM response doesn\'t include `token_usage: {total_tokens: int, prompt_tokens: int}` field.');
  });

  test('should reset handler with new identifier', () => {
    const newHandler = handlerWithBothLimits.reset('user456');
    expect(newHandler.identifier).toBe('user456');
    // @ts-ignore field is private but we will check it for testing
    expect(newHandler._checked).toBeFalsy();
  });

  test('should reset handler without new identifier', () => {
    const newHandler = handlerWithBothLimits.reset();
    expect(newHandler.identifier).toBe('user123');
    // @ts-ignore field is private but we will check it for testing
    expect(newHandler._checked).toBeFalsy();
  });

  test('should call chain start only once', async () => {
    await handlerWithBothLimits.handleChainStart(serialized, {});
    await handlerWithBothLimits.handleChainStart(serialized, {});
    expect(requestRatelimit.limit).toHaveBeenCalledTimes(1);
  });

  test('should reset checked state on reset', async () => {
    await handlerWithBothLimits.handleChainStart(serialized, {});
    const newHandler = handlerWithBothLimits.reset('user456');
    await newHandler.handleChainStart(serialized, {});
    expect(requestRatelimit.limit).toHaveBeenCalledTimes(2); // Because the mock is preserved across resets
  });

  test('should not call token limit on LLM start if no token limit', async () => {
    const handler = new UpstashRatelimitHandler('user123', { requestRatelimit });
    await handler.handleLLMStart(serialized, ['test'], 'runId');
    expect(requestRatelimit.limit).not.toHaveBeenCalled();
  });

  test('should call token limit on LLM start', async () => {
    await handlerWithBothLimits.handleLLMStart(serialized, ['test'], 'runId');
    expect(tokenRatelimit.getRemaining).toHaveBeenCalledTimes(1);
  });

  test('should handle full chain with both limits', async () => {
    await handlerWithBothLimits.handleChainStart(serialized, {});
    await handlerWithBothLimits.handleChainStart(serialized, {});

    expect(requestRatelimit.limit).toHaveBeenCalledTimes(1);
    expect(tokenRatelimit.limit).not.toHaveBeenCalled();
    expect(tokenRatelimit.getRemaining).not.toHaveBeenCalled();

    await handlerWithBothLimits.handleLLMStart(serialized, ['test'], 'runId');

    expect(requestRatelimit.limit).toHaveBeenCalledTimes(1);
    expect(tokenRatelimit.limit).not.toHaveBeenCalled();
    expect(tokenRatelimit.getRemaining).toHaveBeenCalledTimes(1);

    const response: LLMResult = {
      generations: [],
      llmOutput: {
        token_usage: {
          prompt_tokens: 2,
          completion_tokens: 3,
          total_tokens: 5,
        },
      },
    };
    await handlerWithBothLimits.handleLLMEnd(response, 'runId');

    expect(requestRatelimit.limit).toHaveBeenCalledTimes(1);
    expect(tokenRatelimit.limit).toHaveBeenCalledTimes(1);
    expect(tokenRatelimit.getRemaining).toHaveBeenCalledTimes(1);
  });
});
