import { vi, test, expect, describe } from "vitest";
import { z } from "zod";
import {
  ChatAnthropic,
  type ChatAnthropicInput,
  ChatAnthropicMessages,
} from "../chat_models.js";

const DEFAULT_MODEL = "claude-sonnet-5-5";

// Retired on the Claude API on November 30, 2026.
// https://platform.claude.com/docs/en/about-claude/model-deprecations
const RETIRED_MODEL = "claude-sonnet-4-5-20250929";

type MockFetch = ReturnType<
  typeof vi.fn<
    (url: string | URL | Request, options?: RequestInit) => Promise<Response>
  >
>;

function makeMockFetch(
  content: Array<Record<string, unknown>> = [{ type: "text", text: "Hi!" }]
): MockFetch {
  const mockFetch =
    vi.fn<
      (url: string | URL | Request, options?: RequestInit) => Promise<Response>
    >();
  mockFetch.mockImplementation((_url, options) => {
    const { model } = JSON.parse(options?.body as string) as { model: string };
    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model,
          content,
          stop_reason: content.some((block) => block.type === "tool_use")
            ? "tool_use"
            : "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
  });
  return mockFetch;
}

function getRequestBody(mockFetch: MockFetch): Record<string, unknown> {
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [, init] = mockFetch.mock.calls[0];
  if (!init || !init.body) {
    throw new Error("Body not found in request.");
  }
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

function makeMockedModel(
  fields: Omit<ChatAnthropicInput, "clientOptions"> = {},
  mockFetch: MockFetch = makeMockFetch()
): { model: ChatAnthropic; mockFetch: MockFetch } {
  const model = new ChatAnthropic({
    apiKey: "testing",
    maxRetries: 0,
    ...fields,
    clientOptions: { fetch: mockFetch },
  });
  return { model, mockFetch };
}

describe("default model", () => {
  test("uses claude-sonnet-5-5 when no model is passed", () => {
    const model = new ChatAnthropic({ apiKey: "testing" });

    expect(model.model).toBe(DEFAULT_MODEL);
    expect(model.modelName).toBe(DEFAULT_MODEL);
  });

  test("ChatAnthropicMessages uses the same default", () => {
    const model = new ChatAnthropicMessages({ apiKey: "testing" });

    expect(model.model).toBe(DEFAULT_MODEL);
  });

  test("sends the default model in the request", async () => {
    const { model, mockFetch } = makeMockedModel();

    await model.invoke("Hello");

    expect(getRequestBody(mockFetch).model).toBe(DEFAULT_MODEL);
  });

  test("reports the default model to LangSmith", () => {
    const model = new ChatAnthropic({ apiKey: "testing" });

    expect(model.getLsParams({}).ls_model_name).toBe(DEFAULT_MODEL);
  });

  test("has a model profile", () => {
    const model = new ChatAnthropic({ apiKey: "testing" });

    expect(model.profile).toMatchObject({
      maxInputTokens: 1000000,
      toolCalling: true,
    });
  });

  test("keeps the default max_tokens", () => {
    const model = new ChatAnthropic({ apiKey: "testing" });

    expect(model.invocationParams({}).max_tokens).toBe(16384);
  });

  test("does not send thinking or sampling params unless configured", async () => {
    const { model, mockFetch } = makeMockedModel();

    await model.invoke("Hello");

    const body = getRequestBody(mockFetch);
    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("top_k");
    expect(body).not.toHaveProperty("top_p");
  });
});

describe("explicit model overrides", () => {
  test.each([
    ["model", { model: RETIRED_MODEL }],
    ["modelName", { modelName: RETIRED_MODEL }],
  ] as const)(
    "sends a model passed as `%s` unchanged",
    async (_field, fields) => {
      const { model, mockFetch } = makeMockedModel(fields);

      await model.invoke("Hello");

      expect(model.model).toBe(RETIRED_MODEL);
      expect(getRequestBody(mockFetch).model).toBe(RETIRED_MODEL);
    }
  );

  test("sends a model passed as the constructor shorthand unchanged", async () => {
    const mockFetch = makeMockFetch();
    const model = new ChatAnthropic("claude-haiku-4-5-20251001", {
      apiKey: "testing",
      maxRetries: 0,
      clientOptions: { fetch: mockFetch },
    });

    await model.invoke("Hello");

    expect(getRequestBody(mockFetch).model).toBe("claude-haiku-4-5-20251001");
  });

  test("keeps sampling params for an explicit model that accepts them", async () => {
    const { model, mockFetch } = makeMockedModel({
      model: "claude-sonnet-4-6",
      temperature: 0,
    });

    await model.invoke("Hello");

    const body = getRequestBody(mockFetch);
    expect(body.model).toBe("claude-sonnet-4-6");
    expect(body.temperature).toBe(0);
  });

  test("keeps forced tool choice for an explicit model that accepts it", async () => {
    const { model, mockFetch } = makeMockedModel(
      { model: "claude-sonnet-4-6" },
      makeMockFetch([
        {
          type: "tool_use",
          id: "toolu_test",
          name: "Joke",
          input: { setup: "a", punchline: "b" },
        },
      ])
    );

    await model
      .withStructuredOutput(
        z.object({ setup: z.string(), punchline: z.string() }),
        { name: "Joke" }
      )
      .invoke("Tell me a joke");

    expect(getRequestBody(mockFetch).tool_choice).toEqual({
      type: "tool",
      name: "Joke",
    });
  });
});

describe("supported configurations on the default model", () => {
  test("sends adaptive thinking with an effort level", async () => {
    const { model, mockFetch } = makeMockedModel({
      thinking: { type: "adaptive" },
      outputConfig: { effort: "low" },
    });

    await model.invoke("Hello");

    const body = getRequestBody(mockFetch);
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.output_config).toEqual({ effort: "low" });
  });

  test("rejects a non-default temperature before sending the request", async () => {
    const { model, mockFetch } = makeMockedModel({ temperature: 0 });

    await expect(model.invoke("Hello")).rejects.toThrow(
      `temperature is not supported for ${DEFAULT_MODEL} when set to non-default values`
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects a thinking budget before sending the request", async () => {
    const { model, mockFetch } = makeMockedModel({
      thinking: { type: "enabled", budget_tokens: 2048 },
    });

    await expect(model.invoke("Hello")).rejects.toThrow(
      `thinking.type="enabled" is not supported for ${DEFAULT_MODEL}`
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects explicitly disabled thinking before sending the request", async () => {
    const { model, mockFetch } = makeMockedModel({
      thinking: { type: "disabled" },
    });

    await expect(model.invoke("Hello")).rejects.toThrow(
      `thinking.type="disabled" is not supported for ${DEFAULT_MODEL}`
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("withStructuredOutput does not force a tool choice", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { model, mockFetch } = makeMockedModel(
        {},
        makeMockFetch([
          {
            type: "tool_use",
            id: "toolu_test",
            name: "Joke",
            input: { setup: "a", punchline: "b" },
          },
        ])
      );

      const result = await model
        .withStructuredOutput(
          z.object({ setup: z.string(), punchline: z.string() }),
          { name: "Joke" }
        )
        .invoke("Tell me a joke");

      expect(result).toEqual({ setup: "a", punchline: "b" });
      const toolChoice = getRequestBody(mockFetch).tool_choice as
        | { type: string }
        | undefined;
      expect(["any", "tool"]).not.toContain(toolChoice?.type);
    } finally {
      warn.mockRestore();
    }
  });

  test("withStructuredOutput with jsonSchema uses native structured output", async () => {
    const { model, mockFetch } = makeMockedModel(
      {},
      makeMockFetch([
        { type: "text", text: JSON.stringify({ setup: "a", punchline: "b" }) },
      ])
    );

    const result = await model
      .withStructuredOutput(
        z.object({ setup: z.string(), punchline: z.string() }),
        { name: "Joke", method: "jsonSchema" }
      )
      .invoke("Tell me a joke");

    expect(result).toEqual({ setup: "a", punchline: "b" });
    const body = getRequestBody(mockFetch);
    expect(body).not.toHaveProperty("tool_choice");
    expect(body.output_config).toMatchObject({
      format: { type: "json_schema" },
    });
  });
});
