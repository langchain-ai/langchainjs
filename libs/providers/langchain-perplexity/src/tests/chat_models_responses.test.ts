import { vi, test, expect, describe } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import {
  ChatPerplexity,
  convertResponsesToChatResult,
  convertResponsesEventToChunk,
} from "../chat_models.js";

function mockResponses(model: ChatPerplexity) {
  const completionsCreate = vi
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    .spyOn((model as any).client.chat.completions, "create")
    .mockResolvedValue({
      choices: [{ message: { role: "assistant", content: "ok" } }],
      citations: [],
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
      },
    });

  const responsesCreate = vi.fn().mockResolvedValue({
    id: "resp_test",
    model: "openai/gpt-5.4",
    object: "response",
    status: "completed",
    output: [
      {
        id: "msg_test",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: "agent answer" }],
      },
    ],
    output_text: "agent answer",
    usage: {
      input_tokens: 3,
      output_tokens: 5,
      total_tokens: 8,
    },
  });

  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  (model as any).client.responses = { create: responsesCreate };
  return { completionsCreate, responsesCreate };
}

describe("ChatPerplexity useResponsesApi routing", () => {
  test("auto-routes to Responses when payload contains a built-in tool", async () => {
    const model = new ChatPerplexity({
      model: "openai/gpt-5.4",
      apiKey: "test-key",
    });
    const { completionsCreate, responsesCreate } = mockResponses(model);

    await model._generate([new HumanMessage("hi")], {
      tools: [{ type: "web_search" }],
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(responsesCreate).toHaveBeenCalledTimes(1);
    expect(completionsCreate).not.toHaveBeenCalled();
    const payload = responsesCreate.mock.calls[0][0];
    expect(payload.tools).toEqual([{ type: "web_search" }]);
    expect(payload.input).toEqual([{ role: "user", content: "hi" }]);
  });

  test("auto-routes to Responses when previousResponseId is supplied", async () => {
    const model = new ChatPerplexity({
      model: "openai/gpt-5.4",
      apiKey: "test-key",
    });
    const { completionsCreate, responsesCreate } = mockResponses(model);

    await model._generate([new HumanMessage("follow up")], {
      previousResponseId: "resp_abc",
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(responsesCreate).toHaveBeenCalledTimes(1);
    expect(completionsCreate).not.toHaveBeenCalled();
    const payload = responsesCreate.mock.calls[0][0];
    expect(payload.previous_response_id).toBe("resp_abc");
  });

  test("auto-routes to Chat Completions for a plain text request", async () => {
    const model = new ChatPerplexity({
      model: "sonar",
      apiKey: "test-key",
    });
    const { completionsCreate, responsesCreate } = mockResponses(model);

    await model._generate([new HumanMessage("hello")], {});

    expect(completionsCreate).toHaveBeenCalledTimes(1);
    expect(responsesCreate).not.toHaveBeenCalled();
  });

  test("explicit useResponsesApi: true routes to Responses for plain text", async () => {
    const model = new ChatPerplexity({
      model: "openai/gpt-5.4",
      apiKey: "test-key",
      useResponsesApi: true,
    });
    const { completionsCreate, responsesCreate } = mockResponses(model);

    await model._generate([new HumanMessage("plain")], {});

    expect(responsesCreate).toHaveBeenCalledTimes(1);
    expect(completionsCreate).not.toHaveBeenCalled();
  });

  test("explicit useResponsesApi: false routes to Chat Completions despite built-in tools", async () => {
    const model = new ChatPerplexity({
      model: "sonar",
      apiKey: "test-key",
      useResponsesApi: false,
    });
    const { completionsCreate, responsesCreate } = mockResponses(model);

    await model._generate([new HumanMessage("hi")], {
      tools: [{ type: "web_search" }],
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(completionsCreate).toHaveBeenCalledTimes(1);
    expect(responsesCreate).not.toHaveBeenCalled();
  });

  test("converts a Responses API response into an AIMessage with usage_metadata", async () => {
    const model = new ChatPerplexity({
      model: "openai/gpt-5.4",
      apiKey: "test-key",
      useResponsesApi: true,
    });
    mockResponses(model);

    const result = await model._generate([new HumanMessage("hi")], {});

    expect(result.generations).toHaveLength(1);
    expect(result.generations[0].text).toBe("agent answer");
    expect(result.generations[0].message.content).toBe("agent answer");
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const message = result.generations[0].message as any;
    expect(message.usage_metadata).toEqual({
      input_tokens: 3,
      output_tokens: 5,
      total_tokens: 8,
    });
    expect(message.response_metadata.id).toBe("resp_test");
    expect(message.response_metadata.model).toBe("openai/gpt-5.4");
    expect(result.llmOutput?.tokenUsage).toEqual({
      promptTokens: 3,
      completionTokens: 5,
      totalTokens: 8,
    });
  });

  test("converts a function_call output item into a tool_call", () => {
    const result = convertResponsesToChatResult({
      id: "resp_x",
      model: "openai/gpt-5.4",
      object: "response",
      status: "completed",
      output: [
        {
          type: "function_call",
          call_id: "call_1",
          name: "lookup",
          arguments: '{"city":"Paris"}',
        },
      ],
      output_text: "",
      usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
    });

    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    const message = result.generations[0].message as any;
    expect(message.tool_calls).toEqual([
      {
        id: "call_1",
        name: "lookup",
        args: { city: "Paris" },
        type: "tool_call",
      },
    ]);
  });

  test("streams content chunks from output_text.delta events and surfaces usage on completion", async () => {
    const model = new ChatPerplexity({
      model: "openai/gpt-5.4",
      apiKey: "test-key",
      useResponsesApi: true,
    });

    async function* fakeStream() {
      yield { type: "response.output_text.delta", delta: "Hello" };
      yield { type: "response.output_text.delta", delta: " world" };
      yield {
        type: "response.completed",
        response: {
          id: "resp_stream",
          model: "openai/gpt-5.4",
          status: "completed",
          object: "response",
          usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
        },
      };
    }

    const responsesCreate = vi.fn().mockResolvedValue(fakeStream());
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    (model as any).client.responses = { create: responsesCreate };

    const chunks = [];
    for await (const chunk of model._streamResponseChunks(
      [new HumanMessage("hi")],
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any
    )) {
      chunks.push(chunk);
    }

    expect(responsesCreate).toHaveBeenCalledTimes(1);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].text).toBe("Hello");
    expect(chunks[1].text).toBe(" world");
    expect(chunks[2].text).toBe("");
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    expect((chunks[2].message as any).usage_metadata).toEqual({
      input_tokens: 1,
      output_tokens: 2,
      total_tokens: 3,
    });
  });

  test("convertResponsesEventToChunk throws on response.error", () => {
    expect(() =>
      convertResponsesEventToChunk({
        type: "response.error",
        message: "boom",
      })
    ).toThrow("boom");
  });

  test("convertResponsesEventToChunk returns null for unhandled events", () => {
    expect(
      convertResponsesEventToChunk({ type: "response.output_item.added" })
    ).toBeNull();
  });
});
