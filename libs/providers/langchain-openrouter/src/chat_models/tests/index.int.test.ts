/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { z } from "zod/v3";
import {
  AIMessageChunk,
  HumanMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { concat } from "@langchain/core/utils/stream";
import { ChatOpenRouter } from "../index.js";
import { OpenRouterAuthError } from "../../utils/errors.js";

const MODEL = "openai/gpt-4o-mini";

function makeChatModel(overrides?: Record<string, any>) {
  return new ChatOpenRouter({
    model: MODEL,
    maxTokens: 100,
    ...overrides,
  });
}

// ─── Basic invoke ────────────────────────────────────────────────────

test("invoke returns a string response with usage metadata", async () => {
  const model = makeChatModel();
  const res = await model.invoke([new HumanMessage("Say hello")]);

  expect(typeof res.content).toBe("string");
  expect((res.content as string).length).toBeGreaterThan(0);
  expect(res.usage_metadata).toBeDefined();
  expect(res.usage_metadata!.input_tokens).toBeGreaterThan(0);
  expect(res.usage_metadata!.output_tokens).toBeGreaterThan(0);
});

// ─── Streaming ───────────────────────────────────────────────────────

test("stream returns multiple chunks that concatenate", async () => {
  const model = makeChatModel();
  const stream = await model.stream("Count from 1 to 5");
  const chunks: AIMessageChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  expect(chunks.length).toBeGreaterThan(1);

  let combined = chunks[0];
  for (let i = 1; i < chunks.length; i++) {
    combined = concat(combined, chunks[i]);
  }
  expect(typeof combined.content).toBe("string");
  expect((combined.content as string).length).toBeGreaterThan(0);
});

test("stream supports abort signal", async () => {
  const model = makeChatModel({ maxTokens: 500 });
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

// ─── Error handling ──────────────────────────────────────────────────

test("bad API key throws OpenRouterAuthError", async () => {
  const model = makeChatModel({ apiKey: "sk-bad-key" });
  let error: any;
  try {
    await model.invoke([new HumanMessage("Hello")]);
  } catch (e) {
    error = e;
  }
  expect(error).toBeDefined();
  expect(OpenRouterAuthError.isInstance(error)).toBe(true);
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

  test("model calls a bound tool", async () => {
    const model = makeChatModel().bindTools([weatherTool]);
    const res = await model.invoke("What's the weather in San Francisco?");

    expect(res.tool_calls).toBeDefined();
    expect(res.tool_calls!.length).toBeGreaterThanOrEqual(1);
    expect(res.tool_calls![0].name).toBe("get_weather");
    expect(res.tool_calls![0].args).toHaveProperty("location");
  });

  test("full tool calling round-trip", async () => {
    const model = makeChatModel().bindTools([weatherTool]);
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

// ─── Structured output ──────────────────────────────────────────────

describe("withStructuredOutput", () => {
  const personSchema = z.object({
    name: z.string().describe("The person's name"),
    age: z.number().int().positive().describe("The person's age"),
  });

  test("returns parsed object via functionCalling", async () => {
    const model = makeChatModel().withStructuredOutput(personSchema, {
      name: "extract_person",
      method: "functionCalling",
    });

    const res = await model.invoke("Extract: John is 30 years old.");

    expect(res.name).toBe("John");
    expect(res.age).toBe(30);
  });

  test("includeRaw returns both raw message and parsed output", async () => {
    const model = makeChatModel().withStructuredOutput(personSchema, {
      name: "extract_person",
      method: "functionCalling",
      includeRaw: true,
    });

    const res = await model.invoke("Extract: Jane is 25 years old.");

    expect(res.raw).toBeDefined();
    expect(res.parsed).toBeDefined();
    expect(res.parsed.name).toBe("Jane");
    expect(res.parsed.age).toBe(25);
  });
});
