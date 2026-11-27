import { describe, expect, test } from "vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import type { OpenAIClient } from "@langchain/openai";
import { ChatXAI } from "../completions.js";

// Usage block from a grok reasoning model, as posted in
// https://github.com/langchain-ai/langchainjs/issues/8220.
// xAI leaves reasoning out of completion_tokens but counts it in total_tokens:
// 2645 + 30 + 1703 = 4378.
const reasoningUsage = {
  prompt_tokens: 2645,
  completion_tokens: 30,
  total_tokens: 4378,
  prompt_tokens_details: { text_tokens: 2645, cached_tokens: 0 },
  completion_tokens_details: { reasoning_tokens: 1703 },
};

const noReasoningUsage = {
  prompt_tokens: 12,
  completion_tokens: 8,
  total_tokens: 20,
  prompt_tokens_details: { cached_tokens: 0 },
  completion_tokens_details: { reasoning_tokens: 0 },
};

// If reasoning is ever reported inside completion_tokens (the OpenAI
// convention), total_tokens is just prompt + completion and nothing is added.
const reasoningAlreadyInCompletionUsage = {
  prompt_tokens: 10,
  completion_tokens: 250,
  total_tokens: 260,
  completion_tokens_details: { reasoning_tokens: 200 },
};

type Usage = typeof reasoningUsage | typeof noReasoningUsage;

const base = {
  id: "chatcmpl-test",
  created: 0,
  model: "grok-3-mini",
};

function completion(usage: Usage) {
  return {
    ...base,
    object: "chat.completion",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Paris" },
        finish_reason: "stop",
        logprobs: null,
      },
    ],
    usage,
  };
}

function completionChunks(usage: Usage) {
  return [
    {
      ...base,
      object: "chat.completion.chunk",
      choices: [
        {
          index: 0,
          delta: { role: "assistant", content: "Paris" },
          finish_reason: null,
        },
      ],
    },
    {
      ...base,
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    },
    { ...base, object: "chat.completion.chunk", choices: [], usage },
  ];
}

class MockChatXAI extends ChatXAI {
  constructor(
    private readonly usage: Usage,
    streaming = false
  ) {
    super({ apiKey: "fake-key", model: "grok-3-mini", streaming });
  }

  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  override async completionWithRetry(request: any): Promise<any> {
    if (request.stream) {
      const chunks = completionChunks(this.usage);
      return {
        async *[Symbol.asyncIterator]() {
          for (const chunk of chunks) {
            yield chunk as OpenAIClient.Chat.Completions.ChatCompletionChunk;
          }
        },
      };
    }
    return completion(this.usage);
  }
}

const expectedReasoningUsage = {
  input_tokens: 2645,
  output_tokens: 1733,
  total_tokens: 4378,
  input_token_details: { cache_read: 0 },
  output_token_details: { reasoning: 1703 },
};

const expectedNoReasoningUsage = {
  input_tokens: 12,
  output_tokens: 8,
  total_tokens: 20,
  input_token_details: { cache_read: 0 },
  output_token_details: { reasoning: 0 },
};

async function streamAndConcat(model: ChatXAI) {
  let result: AIMessageChunk | undefined;
  for await (const chunk of await model.stream("What is the capital?")) {
    result = result === undefined ? chunk : concat(result, chunk);
  }
  return result;
}

describe("ChatXAI completions usage with reasoning tokens", () => {
  test("invoke adds reasoning tokens to output_tokens", async () => {
    const result = await new MockChatXAI(reasoningUsage).invoke(
      "What is the capital?"
    );
    expect(result.content).toBe("Paris");
    expect(result.usage_metadata).toEqual(expectedReasoningUsage);
  });

  test("invoke with streaming: true adds reasoning tokens once", async () => {
    const result = await new MockChatXAI(reasoningUsage, true).invoke(
      "What is the capital?"
    );
    expect(result.content).toBe("Paris");
    expect(result.usage_metadata).toEqual(expectedReasoningUsage);
  });

  test("stream adds reasoning tokens to output_tokens", async () => {
    const result = await streamAndConcat(new MockChatXAI(reasoningUsage));
    expect(result?.content).toBe("Paris");
    expect(result?.usage_metadata).toEqual(expectedReasoningUsage);
  });

  test("streamEvents v2 reports the adjusted usage", async () => {
    const events = new MockChatXAI(reasoningUsage, true).streamEvents(
      "What is the capital?",
      { version: "v2" }
    );
    const outputs: AIMessageChunk[] = [];
    for await (const event of events) {
      if (event.event === "on_chat_model_end") {
        outputs.push(event.data.output);
      }
    }
    expect(outputs).toHaveLength(1);
    expect(outputs[0].usage_metadata).toEqual(expectedReasoningUsage);
  });

  test("streamEvents reports the adjusted usage", async () => {
    const stream = new MockChatXAI(reasoningUsage, true).streamEvents(
      "What is the capital?"
    );
    const usageEvents = [];
    for await (const event of stream) {
      if (event.event === "usage") {
        usageEvents.push(event.usage);
      }
    }
    expect(usageEvents.length).toBeGreaterThan(0);
    for (const usage of usageEvents) {
      expect(usage).toMatchObject({
        input_tokens: 2645,
        output_tokens: 1733,
        total_tokens: 4378,
      });
    }
    const message = await stream;
    expect(message.text).toBe("Paris");
    expect(message.usage_metadata).toMatchObject({
      input_tokens: 2645,
      output_tokens: 1733,
      total_tokens: 4378,
      output_token_details: { reasoning: 1703 },
    });
  });

  test.each([false, true])(
    "leaves usage without reasoning tokens unchanged (streaming: %s)",
    async (streaming) => {
      const model = new MockChatXAI(noReasoningUsage, streaming);
      const invoked = await model.invoke("What is the capital?");
      expect(invoked.usage_metadata).toEqual(expectedNoReasoningUsage);
      const streamed = await streamAndConcat(model);
      expect(streamed?.usage_metadata).toEqual(expectedNoReasoningUsage);
    }
  );

  test("does not add reasoning tokens that are already in completion_tokens", async () => {
    const model = new MockChatXAI(
      reasoningAlreadyInCompletionUsage as unknown as Usage
    );
    const expected = {
      input_tokens: 10,
      output_tokens: 250,
      total_tokens: 260,
      output_token_details: { reasoning: 200 },
    };
    const invoked = await model.invoke("What is the capital?");
    expect(invoked.usage_metadata).toMatchObject(expected);
    const streamed = await streamAndConcat(model);
    expect(streamed?.usage_metadata).toMatchObject(expected);
  });
});
