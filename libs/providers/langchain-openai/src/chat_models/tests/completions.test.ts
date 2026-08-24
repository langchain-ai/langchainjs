import { describe, it, expect, vi } from "vitest";
import { z } from "zod/v3";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { HumanMessage, AIMessageChunk } from "@langchain/core/messages";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { ChatOpenAICompletions } from "../completions.js";
import { AzureChatOpenAICompletions } from "../../azure/chat_models/completions.js";

describe("ChatOpenAICompletions constructor", () => {
  it("supports string model shorthand", () => {
    const model = new ChatOpenAICompletions("gpt-4o-mini", {
      temperature: 0.1,
    });
    expect(model.model).toBe("gpt-4o-mini");
    expect(model.temperature).toBe(0.1);
  });
});

describe("ChatOpenAICompletions streaming usage_metadata callback", () => {
  it("should call handleLLMNewToken for the usage chunk", async () => {
    const model = new ChatOpenAICompletions({
      model: "gpt-4o-mini",
      apiKey: "test-key",
      streaming: true,
      streamUsage: true,
    });

    // Mock completionWithRetry to return a fake async iterable
    // that simulates: one content chunk, then a usage-only chunk
    const fakeStream = (async function* () {
      // Content chunk
      yield {
        choices: [
          {
            index: 0,
            delta: { role: "assistant" as const, content: "Hello" },
            finish_reason: null,
            logprobs: null,
          },
        ],
        usage: null,
        system_fingerprint: null,
        model: "gpt-4o-mini",
        service_tier: null,
      };
      // Final chunk with finish_reason
      yield {
        choices: [
          {
            index: 0,
            delta: { content: "" },
            finish_reason: "stop",
            logprobs: null,
          },
        ],
        usage: null,
        system_fingerprint: "fp_abc123",
        model: "gpt-4o-mini",
        service_tier: null,
      };
      // Usage-only chunk (no choices)
      yield {
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          prompt_tokens_details: null,
          completion_tokens_details: null,
        },
        system_fingerprint: null,
        model: "gpt-4o-mini",
        service_tier: null,
      };
    })();

    model.completionWithRetry = vi
      .fn()
      .mockResolvedValue(fakeStream) as typeof model.completionWithRetry;

    // Create a mock runManager
    const handleLLMNewToken = vi.fn();
    const runManager = {
      handleLLMNewToken,
    } as unknown as CallbackManagerForLLMRun;

    const chunks = [];
    for await (const chunk of model._streamResponseChunks(
      [new HumanMessage("test")],
      {},
      runManager
    )) {
      chunks.push(chunk);
    }

    // Should have 3 chunks: content, finish, and usage
    expect(chunks.length).toBe(3);

    // The last chunk should have usage_metadata
    const usageChunk = chunks[chunks.length - 1];
    const usageMessage = usageChunk.message as AIMessageChunk;
    expect(usageMessage.usage_metadata).toBeDefined();
    expect(usageMessage.usage_metadata?.input_tokens).toBe(10);
    expect(usageMessage.usage_metadata?.output_tokens).toBe(5);
    expect(usageMessage.usage_metadata?.total_tokens).toBe(15);

    // handleLLMNewToken should have been called for EVERY chunk,
    // including the usage chunk (this is the bug fix)
    expect(handleLLMNewToken).toHaveBeenCalledTimes(3);

    // Verify the last call includes the usage chunk
    const lastCall = handleLLMNewToken.mock.calls[2];
    const lastCallFields = lastCall[5] as {
      chunk: { message: AIMessageChunk };
    };
    expect(lastCallFields.chunk.message.usage_metadata).toBeDefined();
    expect(lastCallFields.chunk.message.usage_metadata?.input_tokens).toBe(10);
  });
});

describe("Chat Completions streaming usage metadata deduplication", () => {
  const cumulativeUsage = {
    prompt_tokens: 100,
    completion_tokens: 5,
    total_tokens: 105,
    prompt_tokens_details: { cached_tokens: 50, cache_write_tokens: 20 },
    completion_tokens_details: { reasoning_tokens: 2 },
  };

  const providers = [
    {
      name: "OpenAI",
      create: () =>
        new ChatOpenAICompletions({
          model: "gpt-4o-mini",
          apiKey: "test-key",
          configuration: { baseURL: "https://api.openai.com/v1" },
          streaming: true,
          streamUsage: true,
          __includeRawResponse: true,
        }),
    },
    {
      name: "Azure OpenAI",
      create: () =>
        new AzureChatOpenAICompletions({
          model: "gpt-4o-mini",
          apiKey: "test-key",
          azureOpenAIApiVersion: "2024-10-21",
          azureOpenAIApiDeploymentName: "gpt-4o-mini",
          azureOpenAIEndpoint: "https://example.openai.azure.com",
          streaming: true,
          streamUsage: true,
          __includeRawResponse: true,
        }),
    },
    {
      name: "LiteLLM-compatible",
      create: () =>
        new ChatOpenAICompletions({
          model: "gpt-5.6-luna",
          apiKey: "test-key",
          configuration: { baseURL: "http://litellm.example.test/v1" },
          streaming: true,
          streamUsage: true,
          __includeRawResponse: true,
        }),
    },
  ] as const;

  it.each(providers)(
    "$name keeps repeated cumulative usage snapshots from being summed",
    async ({ create }) => {
      const model = create();
      const fakeStream = (async function* () {
        // Some OpenAI-compatible servers attach the same cumulative usage
        // snapshot to more than one choice-bearing chunk.
        yield {
          choices: [
            {
              index: 0,
              delta: { role: "assistant" as const, content: "Hello" },
              finish_reason: null,
              logprobs: null,
            },
          ],
          usage: cumulativeUsage,
          system_fingerprint: null,
          model: "provider-model",
          service_tier: null,
        };
        yield {
          choices: [
            {
              index: 0,
              delta: { content: "" },
              finish_reason: "stop",
              logprobs: null,
            },
          ],
          usage: cumulativeUsage,
          system_fingerprint: null,
          model: "provider-model",
          service_tier: null,
        };
      })();

      model.completionWithRetry = vi
        .fn()
        .mockResolvedValue(fakeStream) as typeof model.completionWithRetry;

      const chunks = [];
      for await (const chunk of model._streamResponseChunks(
        [new HumanMessage("test")],
        {}
      )) {
        chunks.push(chunk);
      }

      const firstMessage = chunks[0].message as AIMessageChunk;
      expect(firstMessage.response_metadata.usage).toBeUndefined();
      expect(
        (firstMessage.additional_kwargs.__raw_response as { usage: unknown })
          .usage
      ).toEqual(cumulativeUsage);

      const finalMessage = chunks
        .slice(1)
        .reduce(
          (message, chunk) => message.concat(chunk.message as AIMessageChunk),
          firstMessage
        );

      expect(finalMessage.response_metadata.usage).toEqual(cumulativeUsage);
      expect(finalMessage.usage_metadata).toEqual({
        input_tokens: 100,
        output_tokens: 5,
        total_tokens: 105,
        input_token_details: {
          cache_read: 50,
          cache_creation: 20,
        },
        output_token_details: { reasoning: 2 },
      });
    }
  );
});

describe("ChatOpenAICompletions cache token usage_metadata", () => {
  it("should map cache_write_tokens to cache_creation for streaming responses", async () => {
    const model = new ChatOpenAICompletions({
      model: "gpt-4o-mini",
      apiKey: "test-key",
      streaming: true,
      streamUsage: true,
    });

    const fakeStream = (async function* () {
      yield {
        choices: [
          {
            index: 0,
            delta: { role: "assistant" as const, content: "Hello" },
            finish_reason: null,
            logprobs: null,
          },
        ],
        usage: null,
        system_fingerprint: null,
        model: "gpt-4o-mini",
        service_tier: null,
      };
      yield {
        choices: [],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 5,
          total_tokens: 105,
          prompt_tokens_details: { cached_tokens: 50, cache_write_tokens: 20 },
          completion_tokens_details: null,
        },
        system_fingerprint: null,
        model: "gpt-4o-mini",
        service_tier: null,
      };
    })();

    model.completionWithRetry = vi
      .fn()
      .mockResolvedValue(fakeStream) as typeof model.completionWithRetry;

    const chunks = [];
    for await (const chunk of model._streamResponseChunks(
      [new HumanMessage("test")],
      {}
    )) {
      chunks.push(chunk);
    }

    const usageChunk = chunks[chunks.length - 1];
    const usageMessage = usageChunk.message as AIMessageChunk;
    expect(usageMessage.usage_metadata?.input_token_details).toEqual({
      cache_read: 50,
      cache_creation: 20,
    });
  });

  it("should map cache_write_tokens to cache_creation for non-streaming responses", async () => {
    const model = new ChatOpenAICompletions({
      model: "gpt-4o-mini",
      apiKey: "test-key",
    });

    model.completionWithRetry = vi.fn().mockResolvedValue({
      id: "chatcmpl-test",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hello" },
          finish_reason: "stop",
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 5,
        total_tokens: 105,
        prompt_tokens_details: { cached_tokens: 50, cache_write_tokens: 20 },
        completion_tokens_details: null,
      },
    }) as typeof model.completionWithRetry;

    const result = await model._generate([new HumanMessage("test")], {});

    const message = result.generations[0].message as AIMessageChunk;
    expect(message.usage_metadata?.input_token_details).toEqual({
      cache_read: 50,
      cache_creation: 20,
    });
  });

  it("should omit cache_creation when cache_write_tokens is absent (non-streaming)", async () => {
    const model = new ChatOpenAICompletions({
      model: "gpt-4o-mini",
      apiKey: "test-key",
    });

    model.completionWithRetry = vi.fn().mockResolvedValue({
      id: "chatcmpl-test",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hello" },
          finish_reason: "stop",
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 5,
        total_tokens: 105,
        // No cache_write_tokens key at all, as returned by models that
        // don't support explicit prompt caching.
        prompt_tokens_details: { cached_tokens: 0, audio_tokens: null },
        completion_tokens_details: null,
      },
    }) as typeof model.completionWithRetry;

    const result = await model._generate([new HumanMessage("test")], {});

    const message = result.generations[0].message as AIMessageChunk;
    expect(message.usage_metadata?.input_token_details).not.toHaveProperty(
      "cache_creation"
    );
  });
});

describe("ChatOpenAICompletions reasoning_content compatibility", () => {
  it("should preserve reasoning_content on streamed assistant chunks", async () => {
    const model = new ChatOpenAICompletions({
      model: "gpt-5.4",
      apiKey: "test-key",
      streaming: true,
    });

    const fakeStream = (async function* () {
      yield {
        choices: [
          {
            index: 0,
            delta: {
              role: "assistant" as const,
              content: "",
              reasoning_content: "The user",
            },
            finish_reason: null,
            logprobs: null,
          },
        ],
        usage: null,
        system_fingerprint: null,
        model: "gpt-5.4",
        service_tier: null,
      };
      yield {
        choices: [
          {
            index: 0,
            delta: { content: "" },
            finish_reason: "stop",
            logprobs: null,
          },
        ],
        usage: null,
        system_fingerprint: null,
        model: "gpt-5.4",
        service_tier: null,
      };
    })();

    model.completionWithRetry = vi
      .fn()
      .mockResolvedValue(fakeStream) as typeof model.completionWithRetry;

    const chunks = [];
    for await (const chunk of model._streamResponseChunks(
      [new HumanMessage("1+1=?")],
      {}
    )) {
      chunks.push(chunk);
    }

    const firstChunk = chunks[0].message as AIMessageChunk;
    expect(firstChunk.additional_kwargs.reasoning_content).toBe("The user");
  });
});

describe("ChatOpenAICompletions strict tools for structured output", () => {
  const weatherTool = {
    type: "function" as const,
    function: {
      name: "get_current_weather",
      description: "Get the current weather in a location",
      parameters: toJsonSchema(z.object({ location: z.string() })),
    },
  };
  const jsonSchemaResponseFormat = {
    type: "json_schema" as const,
    json_schema: {
      name: "answer",
      schema: toJsonSchema(z.object({ answer: z.string() })),
    },
  };

  /** Return the per-tool `strict` flag invocationParams produces for `options`. */
  function toolStrict(
    options: Record<string, unknown>,
    extra?: { streaming?: boolean }
  ): boolean | undefined {
    const model = new ChatOpenAICompletions({
      model: "gpt-4",
      apiKey: "test-key",
    });
    const params = (
      model as unknown as {
        invocationParams: (
          o: Record<string, unknown>,
          e?: { streaming?: boolean }
        ) => { tools?: { function: { strict?: boolean } }[] };
      }
    ).invocationParams({ tools: [weatherTool], ...options }, extra);
    return params.tools?.[0]?.function?.strict;
  }

  it("defaults strict to true when a json_schema response_format is requested", () => {
    expect(toolStrict({ response_format: jsonSchemaResponseFormat })).toBe(
      true
    );
  });

  it("respects an explicit strict:false even with a json_schema response_format", () => {
    expect(
      toolStrict({ response_format: jsonSchemaResponseFormat, strict: false })
    ).toBe(false);
  });

  it("does not set strict when no response_format is requested", () => {
    expect(toolStrict({})).toBeUndefined();
  });

  it("does not set strict for a streaming json_schema request (create() path)", () => {
    // Streaming goes through create(), not .parse(), so strict isn't required.
    expect(
      toolStrict(
        { response_format: jsonSchemaResponseFormat },
        { streaming: true }
      )
    ).toBeUndefined();
  });

  it("does not set strict for a json_object response_format (JSON mode)", () => {
    expect(
      toolStrict({ response_format: { type: "json_object" } })
    ).toBeUndefined();
  });
});
