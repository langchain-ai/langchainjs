import { describe, expect, test, vi } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import type { ChatGenerationChunk } from "@langchain/core/outputs";
import { OutputParserException } from "@langchain/core/output_parsers";
import { ChatOllama } from "../chat_models.js";

describe("ChatOllama constructor overload", () => {
  test("accepts a model string shorthand", () => {
    const modelFromString = new ChatOllama("llama3");
    const modelFromObject = new ChatOllama({ model: "llama3" });

    expect(modelFromString.model).toBe("llama3");
    expect(modelFromObject.model).toBe("llama3");
  });

  test("merges model string with additional params", () => {
    const baseUrl = "http://127.0.0.1:11435";
    const model = new ChatOllama("llama3", { baseUrl });

    expect(model.model).toBe("llama3");
    expect(model.baseUrl).toBe(baseUrl);
  });
});

describe("withStructuredOutput - StandardSchema", () => {
  function makeSerializableSchema() {
    return {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: (value: unknown) => {
          const v = value as Record<string, unknown>;
          if (v && typeof v === "object" && "name" in v) {
            return { value: v as { name: string } };
          }
          return {
            issues: [{ message: "Expected object with name" }],
          };
        },
        jsonSchema: {
          input: () => ({
            type: "object" as const,
            properties: {
              name: { type: "string", description: "A name" },
            },
            required: ["name"],
          }),
          output: () => ({ type: "object" as const, properties: {} }),
        },
      },
    };
  }

  test("functionCalling with valid output parses correctly", async () => {
    const model = new ChatOllama({ model: "llama3" });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "extract",
              args: { name: "cobalt" },
              id: "1",
              type: "tool_call",
            },
          ],
        })
      );

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "functionCalling",
    });

    const result = await structured.invoke("What?");
    expect(result).toEqual({ name: "cobalt" });
  });

  test("functionCalling with invalid output throws OutputParserException", async () => {
    const model = new ChatOllama({ model: "llama3" });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "extract",
              args: { invalid: true },
              id: "1",
              type: "tool_call",
            },
          ],
        })
      );

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "functionCalling",
    });

    await expect(async () => {
      await structured.invoke("What?");
    }).rejects.toThrow(OutputParserException);
  });

  test("functionCalling with custom name", async () => {
    const model = new ChatOllama({ model: "llama3" });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "GetName",
              args: { name: "test" },
              id: "1",
              type: "tool_call",
            },
          ],
        })
      );

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "functionCalling",
      name: "GetName",
    });

    const result = await structured.invoke("What?");
    expect(result).toEqual({ name: "test" });
  });

  test("functionCalling with includeRaw returns raw and parsed", async () => {
    const mockResponse = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "extract",
          args: { name: "cobalt" },
          id: "1",
          type: "tool_call",
        },
      ],
    });
    const model = new ChatOllama({ model: "llama3" });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(mockResponse);

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "functionCalling",
      includeRaw: true,
    });

    const result = await structured.invoke("What?");
    expect(result).toHaveProperty("raw");
    expect(result).toHaveProperty("parsed");
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).parsed).toEqual({ name: "cobalt" });
  });

  test("jsonMode with valid output parses correctly", async () => {
    const model = new ChatOllama({ model: "llama3" });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(new AIMessage({ content: '{"name": "Alice"}' }));

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "jsonMode",
    });

    const result = await structured.invoke("What?");
    expect(result).toEqual({ name: "Alice" });
  });

  test("jsonMode with invalid output throws OutputParserException", async () => {
    const model = new ChatOllama({ model: "llama3" });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(new AIMessage({ content: '{"wrong_field": 123}' }));

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "jsonMode",
    });

    await expect(async () => {
      await structured.invoke("What?");
    }).rejects.toThrow(OutputParserException);
  });

  test("jsonSchema with valid output parses correctly", async () => {
    const model = new ChatOllama({ model: "llama3" });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(new AIMessage({ content: '{"name": "Eve"}' }));

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "jsonSchema",
    });

    const result = await structured.invoke("What?");
    expect(result).toEqual({ name: "Eve" });
  });

  test("jsonSchema with invalid output throws OutputParserException", async () => {
    const model = new ChatOllama({ model: "llama3" });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(new AIMessage({ content: '{"wrong_field": 123}' }));

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "jsonSchema",
    });

    await expect(async () => {
      await structured.invoke("What?");
    }).rejects.toThrow(OutputParserException);
  });
});

describe("finish reason response metadata", () => {
  function mockChat(chunks: Record<string, unknown>[]) {
    const model = new ChatOllama({ model: "llama3" });
    vi.spyOn(model.client, "chat").mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    } as never);
    return model;
  }

  test.each([
    ["stop", "stop"],
    ["length", "length"],
    ["load", "other"],
  ])("invoke maps %s to %s", async (doneReason, normalized) => {
    const model = mockChat([
      { message: { role: "assistant", content: "hi" } },
      { message: { role: "assistant", content: "" }, done_reason: doneReason },
    ]);

    const result = await model.invoke("Hello");

    expect(result.response_metadata).toMatchObject({
      done_reason: doneReason,
      finish_reason: doneReason,
      normalized_finish_reason: normalized,
    });
  });

  test("invoke maps stop with tool calls to tool_call", async () => {
    const model = mockChat([
      {
        message: {
          role: "assistant",
          content: "",
          tool_calls: [{ function: { name: "search", arguments: {} } }],
        },
      },
      { message: { role: "assistant", content: "" }, done_reason: "stop" },
    ]);

    const result = await model.invoke("Hello");

    expect(result.response_metadata).toMatchObject({
      finish_reason: "stop",
      normalized_finish_reason: "tool_call",
    });
  });

  test("invoke sets nothing without a done reason", async () => {
    const model = mockChat([{ message: { role: "assistant", content: "hi" } }]);

    const result = await model.invoke("Hello");

    expect(result.response_metadata).not.toHaveProperty("finish_reason");
    expect(result.response_metadata).not.toHaveProperty(
      "normalized_finish_reason"
    );
  });

  test("legacy stream sets finish keys only on the final chunk", async () => {
    const model = mockChat([
      { message: { role: "assistant", content: "hi" } },
      { message: { role: "assistant", content: "" }, done_reason: "length" },
    ]);

    const chunks: ChatGenerationChunk[] = [];
    for await (const chunk of model._streamResponseChunks(
      [new HumanMessage("Hello")],
      {}
    )) {
      chunks.push(chunk);
    }

    const withFinish = chunks.filter(
      (c) => c.message.response_metadata.finish_reason !== undefined
    );
    expect(withFinish).toEqual([chunks[chunks.length - 1]]);
    expect(withFinish[0].message.response_metadata).toMatchObject({
      finish_reason: "length",
      normalized_finish_reason: "length",
    });
  });
});
