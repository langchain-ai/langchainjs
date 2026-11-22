import { describe, it, expect, vi } from "vitest";
import { AIMessageChunk, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAICompletions } from "../completions.js";
import { ChatOpenAIResponses } from "../responses.js";
import { AzureChatOpenAICompletions } from "../../azure/chat_models/completions.js";

function completion(message: Record<string, unknown>, finishReason: string) {
  return {
    id: "chatcmpl-test",
    model: "gpt-4o-mini",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: null, ...message },
        finish_reason: finishReason,
        logprobs: null,
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

const toolCall = {
  id: "call_1",
  type: "function",
  function: { name: "get_weather", arguments: '{"city":"SF"}' },
};

async function invokeCompletions(
  response: ReturnType<typeof completion>,
  model: ChatOpenAICompletions = new ChatOpenAICompletions({
    model: "gpt-4o-mini",
    apiKey: "test-key",
  })
) {
  model.completionWithRetry = vi
    .fn()
    .mockResolvedValue(response) as typeof model.completionWithRetry;
  return model.invoke([new HumanMessage("hi")]);
}

describe("Chat Completions finish reason", () => {
  it.each([
    ["stop", { content: "Hello" }, "stop"],
    ["length", { content: "Hel" }, "length"],
    ["tool_calls", { tool_calls: [toolCall] }, "tool_call"],
    ["stop", { tool_calls: [toolCall] }, "tool_call"],
    ["content_filter", { content: "" }, "content_filter"],
    ["stop", { refusal: "I can't help with that." }, "refusal"],
    ["something_new", { content: "Hello" }, "other"],
  ])(
    "maps %s with %j to %s on invoke",
    async (finishReason, message, expected) => {
      const result = await invokeCompletions(completion(message, finishReason));
      expect(result.response_metadata.finish_reason).toBe(finishReason);
      expect(result.response_metadata.normalized_finish_reason).toBe(expected);
      expect(result.response_metadata).not.toHaveProperty("finish_state");
    }
  );

  it("is inherited by Azure", async () => {
    const result = await invokeCompletions(
      completion({ content: "Hel" }, "length"),
      new AzureChatOpenAICompletions({
        azureOpenAIEndpoint: "https://foobar.openai.azure.com/",
        azureOpenAIApiDeploymentName: "gpt-4o",
        azureOpenAIApiVersion: "2024-08-01-preview",
        azureOpenAIApiKey: "foo",
      })
    );
    expect(result.response_metadata.normalized_finish_reason).toBe("length");
  });

  it("sets the normalized reason only on the legacy stream finish chunk", async () => {
    const model = new ChatOpenAICompletions({
      model: "gpt-4o-mini",
      apiKey: "test-key",
    });
    const chunk = (
      delta: Record<string, unknown>,
      finishReason: string | null
    ) => ({
      id: "chatcmpl-test",
      model: "gpt-4o-mini",
      choices: [
        { index: 0, delta, finish_reason: finishReason, logprobs: null },
      ],
      usage: null,
    });
    model.completionWithRetry = vi.fn().mockResolvedValue(
      (async function* () {
        yield chunk({ role: "assistant", content: "Hel" }, null);
        yield chunk({ content: "lo" }, null);
        yield chunk({ content: "" }, "length");
      })()
    ) as typeof model.completionWithRetry;

    const chunks = [];
    for await (const generationChunk of model._streamResponseChunks(
      [new HumanMessage("hi")],
      {}
    )) {
      chunks.push(generationChunk);
    }
    expect(
      chunks.map((c) => c.generationInfo?.normalized_finish_reason)
    ).toEqual([undefined, undefined, "length"]);
    expect(chunks[2].generationInfo?.finish_reason).toBe("length");
  });

  it("exposes the normalized reason on the aggregated legacy stream", async () => {
    const model = new ChatOpenAICompletions({
      model: "gpt-4o-mini",
      apiKey: "test-key",
    });
    model.completionWithRetry = vi.fn().mockResolvedValue(
      (async function* () {
        yield {
          id: "chatcmpl-test",
          model: "gpt-4o-mini",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: "Hello" },
              finish_reason: null,
              logprobs: null,
            },
          ],
          usage: null,
        };
        yield {
          id: "chatcmpl-test",
          model: "gpt-4o-mini",
          choices: [
            {
              index: 0,
              delta: { content: "" },
              finish_reason: "stop",
              logprobs: null,
            },
          ],
          usage: null,
        };
      })()
    ) as typeof model.completionWithRetry;

    let final: AIMessageChunk | undefined;
    for await (const c of await model.stream([new HumanMessage("hi")])) {
      final = final ? final.concat(c) : c;
    }
    expect(final?.response_metadata.finish_reason).toBe("stop");
    expect(final?.response_metadata.normalized_finish_reason).toBe("stop");
  });
});

function response(overrides: Record<string, unknown> = {}) {
  return {
    id: "resp_1",
    object: "response",
    created_at: 0,
    model: "gpt-4o-mini",
    status: "completed",
    incomplete_details: null,
    error: null,
    output: [
      {
        type: "message",
        id: "msg_1",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: "Hello", annotations: [] }],
      },
    ],
    usage: {
      input_tokens: 1,
      output_tokens: 1,
      total_tokens: 2,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
    },
    ...overrides,
  };
}

async function invokeResponses(data: ReturnType<typeof response>) {
  const model = new ChatOpenAIResponses({ model: "gpt-4o-mini" });
  model.completionWithRetry = vi
    .fn()
    .mockResolvedValue(data) as typeof model.completionWithRetry;
  return model.invoke([new HumanMessage("hi")]);
}

describe("Responses API finish reason", () => {
  it("maps completed to stop", async () => {
    const result = await invokeResponses(response());
    expect(result.response_metadata.finish_reason).toBe("completed");
    expect(result.response_metadata.normalized_finish_reason).toBe("stop");
    expect(result.response_metadata).not.toHaveProperty("finish_state");
  });

  it("maps completed with a function call to tool_call", async () => {
    const result = await invokeResponses(
      response({
        output: [
          {
            type: "function_call",
            id: "fc_1",
            call_id: "call_1",
            name: "get_weather",
            arguments: '{"city":"SF"}',
            status: "completed",
          },
        ],
      })
    );
    expect(result.response_metadata.finish_reason).toBe("completed");
    expect(result.response_metadata.normalized_finish_reason).toBe("tool_call");
  });

  it("maps incomplete max_output_tokens to length", async () => {
    const result = await invokeResponses(
      response({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
      })
    );
    expect(result.response_metadata.finish_reason).toBe("incomplete");
    expect(result.response_metadata.normalized_finish_reason).toBe("length");
  });

  it("maps incomplete content_filter to content_filter", async () => {
    const result = await invokeResponses(
      response({
        status: "incomplete",
        incomplete_details: { reason: "content_filter" },
      })
    );
    expect(result.response_metadata.normalized_finish_reason).toBe(
      "content_filter"
    );
  });

  it("maps refusal output to refusal", async () => {
    const result = await invokeResponses(
      response({
        output: [
          {
            type: "message",
            id: "msg_1",
            role: "assistant",
            status: "completed",
            content: [{ type: "refusal", refusal: "I can't help with that." }],
          },
        ],
      })
    );
    expect(result.response_metadata.finish_reason).toBe("completed");
    expect(result.response_metadata.normalized_finish_reason).toBe("refusal");
  });

  it("sets the fields on the legacy stream completed chunk", async () => {
    const model = new ChatOpenAIResponses({ model: "gpt-4o-mini" });
    model.completionWithRetry = vi.fn().mockResolvedValue(
      (async function* () {
        yield {
          type: "response.output_text.delta",
          item_id: "msg_1",
          output_index: 0,
          content_index: 0,
          delta: "Hel",
          sequence_number: 1,
        };
        yield {
          type: "response.incomplete",
          sequence_number: 2,
          response: response({
            status: "incomplete",
            incomplete_details: { reason: "max_output_tokens" },
          }),
        };
      })()
    ) as typeof model.completionWithRetry;

    let final: AIMessageChunk | undefined;
    for await (const c of model._streamResponseChunks(
      [new HumanMessage("hi")],
      {}
    )) {
      final = final
        ? final.concat(c.message as AIMessageChunk)
        : (c.message as AIMessageChunk);
    }
    expect(final?.response_metadata.finish_reason).toBe("incomplete");
    expect(final?.response_metadata.normalized_finish_reason).toBe("length");
  });
});
