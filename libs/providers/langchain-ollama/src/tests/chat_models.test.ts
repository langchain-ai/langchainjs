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

function makeSerializableSchema() {
  return {
    "~standard": {
      version: 1 as const,
      vendor: "test",
      validate: (value: unknown) => {
        const obj = value as Record<string, unknown>;
        if (
          typeof obj === "object" &&
          obj !== null &&
          typeof obj.name === "string"
        ) {
          return { value: obj };
        }
        return {
          issues: [{ message: "Expected object with string 'name' field" }],
        };
      },
      jsonSchema: {
        input: () => ({
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        }),
        output: () => ({
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        }),
      },
    },
  };
}

describe("withStructuredOutput with SerializableSchema", () => {
  test("functionCalling with valid output parses correctly", async () => {
    const model = new ChatOllama({ model: "llama3" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call_123",
            name: "extract",
            args: { name: "Claude" },
          },
        ],
      })
    );

    const schema = makeSerializableSchema();
    const modelWithStructuredOutput = model.withStructuredOutput(schema, {
      method: "functionCalling",
    });

    const result = await modelWithStructuredOutput.invoke("What is your name?");
    expect(result).toEqual({ name: "Claude" });
  });

  test("functionCalling with invalid output throws OutputParserException", async () => {
    const model = new ChatOllama({ model: "llama3" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call_123",
            name: "extract",
            args: { wrong_field: 123 },
          },
        ],
      })
    );

    const schema = makeSerializableSchema();
    const modelWithStructuredOutput = model.withStructuredOutput(schema, {
      method: "functionCalling",
    });

    await expect(async () => {
      await modelWithStructuredOutput.invoke("What is your name?");
    }).rejects.toThrow(OutputParserException);
  });

  test("functionCalling with custom name", async () => {
    const model = new ChatOllama({ model: "llama3" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: "",
        tool_calls: [
          {
            id: "call_123",
            name: "PersonInfo",
            args: { name: "Alice" },
          },
        ],
      })
    );

    const schema = makeSerializableSchema();
    const modelWithStructuredOutput = model.withStructuredOutput(schema, {
      method: "functionCalling",
      name: "PersonInfo",
    });

    const result = await modelWithStructuredOutput.invoke("Who is this?");
    expect(result).toEqual({ name: "Alice" });
  });

  test("functionCalling with includeRaw returns raw and parsed", async () => {
    const rawMessage = new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "call_123",
          name: "extract",
          args: { name: "Bob" },
        },
      ],
    });
    const model = new ChatOllama({ model: "llama3" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(rawMessage);

    const schema = makeSerializableSchema();
    const modelWithStructuredOutput = model.withStructuredOutput(schema, {
      method: "functionCalling",
      includeRaw: true,
    });

    const result = await modelWithStructuredOutput.invoke("Tell me a name");
    expect(result).toHaveProperty("raw");
    expect(result).toHaveProperty("parsed");
    expect(result.parsed).toEqual({ name: "Bob" });
  });

  test("jsonMode with valid output parses correctly", async () => {
    const model = new ChatOllama({ model: "llama3" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: '{"name": "Alice"}',
      })
    );

    const schema = makeSerializableSchema();
    const modelWithStructuredOutput = model.withStructuredOutput(schema, {
      method: "jsonMode",
    });

    const result = await modelWithStructuredOutput.invoke("What is your name?");
    expect(result).toEqual({ name: "Alice" });
  });

  test("jsonMode with invalid output throws OutputParserException", async () => {
    const model = new ChatOllama({ model: "llama3" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: '{"wrong_field": 123}',
      })
    );

    const schema = makeSerializableSchema();
    const modelWithStructuredOutput = model.withStructuredOutput(schema, {
      method: "jsonMode",
    });

    await expect(async () => {
      await modelWithStructuredOutput.invoke("What is your name?");
    }).rejects.toThrow(OutputParserException);
  });

  test("jsonSchema with valid output parses correctly", async () => {
    const model = new ChatOllama({ model: "llama3" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: '{"name": "Eve"}',
      })
    );

    const schema = makeSerializableSchema();
    const modelWithStructuredOutput = model.withStructuredOutput(schema, {
      method: "jsonSchema",
    });

    const result = await modelWithStructuredOutput.invoke("What is your name?");
    expect(result).toEqual({ name: "Eve" });
  });

  test("jsonSchema with invalid output throws OutputParserException", async () => {
    const model = new ChatOllama({ model: "llama3" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(model as any, "invoke").mockResolvedValue(
      new AIMessage({
        content: '{"wrong_field": 123}',
      })
    );

    const schema = makeSerializableSchema();
    const modelWithStructuredOutput = model.withStructuredOutput(schema, {
      method: "jsonSchema",
    });

    await expect(async () => {
      await modelWithStructuredOutput.invoke("What is your name?");
    }).rejects.toThrow(OutputParserException);
  });
});
