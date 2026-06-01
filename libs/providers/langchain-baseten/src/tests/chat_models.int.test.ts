import { describe, it, expect, test } from "vitest";
import {
  HumanMessage,
  AIMessage,
  AIMessageChunk,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { concat } from "@langchain/core/utils/stream";
import { z } from "zod/v3";
import { ChatBaseten } from "../chat_models.js";

const BASETEN_MODEL = "deepseek-ai/DeepSeek-V3.1";

function makeModel(overrides?: Record<string, unknown>) {
  return new ChatBaseten({
    model: BASETEN_MODEL,
    maxTokens: 200,
    ...overrides,
  });
}

// ─── Basic invoke ────────────────────────────────────────────────────

describe("ChatBaseten Integration Tests", () => {
  it("should invoke ChatBaseten directly", { timeout: 60_000 }, async () => {
    const model = makeModel();

    const result = await model.invoke([
      new HumanMessage("What is 2 + 2? Answer with just the number."),
    ]);

    expect(result.content).toBeTruthy();
    expect(typeof result.content).toBe("string");
    expect(result.content).toContain("4");
  });

  it(
    "should stream responses from ChatBaseten",
    { timeout: 60_000 },
    async () => {
      const model = makeModel();

      const chunks: AIMessageChunk[] = [];
      for await (const chunk of await model.stream(
        "Say the word 'hello' and nothing else."
      )) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(1);

      let combined = chunks[0];
      for (let i = 1; i < chunks.length; i++) {
        combined = concat(combined, chunks[i]);
      }
      expect(typeof combined.content).toBe("string");
      expect((combined.content as string).toLowerCase()).toContain("hello");
    }
  );

  it("invoke returns usage metadata", { timeout: 60_000 }, async () => {
    const model = makeModel();
    const res = await model.invoke([new HumanMessage("Say hi")]);

    expect(res.usage_metadata).toBeDefined();
    expect(res.usage_metadata!.input_tokens).toBeGreaterThan(0);
    expect(res.usage_metadata!.output_tokens).toBeGreaterThan(0);
  });

  it("stream supports abort signal", { timeout: 60_000 }, async () => {
    const model = makeModel({ maxTokens: 500 });
    await expect(async () => {
      const stream = await model.stream(
        "Write a very long story about a robot.",
        { signal: AbortSignal.timeout(500) }
      );
      for await (const _chunk of stream) {
        // consume
      }
    }).rejects.toThrow();
  });
});

// ─── Tool calling ────────────────────────────────────────────────────

describe("tool calling", () => {
  const weatherTool = tool(
    async (input: { location: string }) =>
      `The weather in ${input.location} is sunny, 72°F.`,
    {
      name: "get_weather",
      description: "Get the current weather for a location.",
      schema: z.object({
        location: z.string().describe("City name"),
      }),
    }
  );

  test("model calls a bound tool", { timeout: 60_000 }, async () => {
    const model = makeModel().bindTools([weatherTool]);
    const res = await model.invoke("What's the weather in San Francisco?");

    expect(res.tool_calls).toBeDefined();
    expect(res.tool_calls!.length).toBeGreaterThanOrEqual(1);
    expect(res.tool_calls![0].name).toBe("get_weather");
    expect(res.tool_calls![0].args).toHaveProperty("location");
  });

  test("full tool calling round-trip", { timeout: 60_000 }, async () => {
    const model = makeModel().bindTools([weatherTool]);
    const aiMsg = await model.invoke("What's the weather in Paris?");

    expect(aiMsg.tool_calls!.length).toBeGreaterThanOrEqual(1);
    const toolCall = aiMsg.tool_calls![0];

    const toolResult = await weatherTool.invoke(toolCall.args);

    const finalRes = await model.invoke([
      new HumanMessage("What's the weather in Paris?"),
      new AIMessage({
        content: aiMsg.content,
        tool_calls: aiMsg.tool_calls,
      }),
      new ToolMessage({
        tool_call_id: toolCall.id!,
        content: toolResult,
      }),
    ]);

    expect(typeof finalRes.content).toBe("string");
    expect((finalRes.content as string).length).toBeGreaterThan(0);
  });
});
