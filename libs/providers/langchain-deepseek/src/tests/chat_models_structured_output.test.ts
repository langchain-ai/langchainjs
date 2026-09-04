import { describe, test, expect, beforeEach } from "vitest";

import { ChatDeepSeek } from "../chat_models.js";

const schema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" },
  },
  required: ["name", "age"],
} as const;

let capturedBodies: Record<string, unknown>[] = [];

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = "test";
  capturedBodies = [];
});

function captureFetch(): typeof fetch {
  return (async (_url, init) => {
    capturedBodies.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({
        id: "cmpl-1",
        object: "chat.completion",
        created: 0,
        model: "deepseek-test",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: '{"name":"a","age":1}' },
            finish_reason: "stop",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;
}

describe("ChatDeepSeek structured output with reasoning models", () => {
  test("v4-pro defaults to JSON mode instead of tool calling", async () => {
    const model = new ChatDeepSeek({
      model: "deepseek-v4-pro",
      configuration: { fetch: captureFetch() },
    });

    await model.withStructuredOutput(schema).invoke("Return a JSON");

    expect(capturedBodies).toHaveLength(1);
    const body = capturedBodies[0];
    // No tool_choice / tools — the request must not hit the reasoning-mode 400.
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  test("v4-flash defaults to JSON mode instead of tool calling", async () => {
    const model = new ChatDeepSeek({
      model: "deepseek-v4-flash",
      configuration: { fetch: captureFetch() },
    });

    await model.withStructuredOutput(schema).invoke("Return a JSON");

    const body = capturedBodies[0];
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  test("deepseek-reasoner defaults to JSON mode instead of tool calling", async () => {
    const model = new ChatDeepSeek({
      model: "deepseek-reasoner",
      configuration: { fetch: captureFetch() },
    });

    await model.withStructuredOutput(schema).invoke("Return a JSON");

    const body = capturedBodies[0];
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  test("deepseek-chat keeps the functionCalling default", async () => {
    const model = new ChatDeepSeek({
      model: "deepseek-chat",
      configuration: { fetch: captureFetch() },
    });

    await model.withStructuredOutput(schema).invoke("Return a JSON");

    const body = capturedBodies[0];
    expect(body.tools).toBeDefined();
    expect(body.tool_choice).toBeDefined();
    expect(body.response_format).toBeUndefined();
  });

  test("an explicit method is never overridden", async () => {
    const model = new ChatDeepSeek({
      model: "deepseek-v4-pro",
      configuration: { fetch: captureFetch() },
    });

    await model
      .withStructuredOutput(schema, { method: "functionCalling" })
      .invoke("Return a JSON");

    const body = capturedBodies[0];
    expect(body.tools).toBeDefined();
    expect(body.tool_choice).toBeDefined();
  });
});
