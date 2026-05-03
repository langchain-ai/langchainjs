import { describe, expect, test, vi } from "vitest";
import { AIMessage } from "@langchain/core/messages";
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
