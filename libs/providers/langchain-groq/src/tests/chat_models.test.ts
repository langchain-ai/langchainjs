import { vi, test, expect, describe } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  ChatMessage,
} from "@langchain/core/messages";
import { OutputParserException } from "@langchain/core/output_parsers";
import { ChatGroq, messageToGroqRole } from "../chat_models.js";

test("Serialization", () => {
  const model = new ChatGroq({
    apiKey: "foo",
    model: "llama-3.3-70b-versatile",
  });
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","groq","ChatGroq"],"kwargs":{"api_key":{"lc":1,"type":"secret","id":["GROQ_API_KEY"]},"model":"llama-3.3-70b-versatile"}}`
  );
});

test("Constructor shorthand", () => {
  const model = new ChatGroq("llama-3.3-70b-versatile", {
    apiKey: "foo",
    temperature: 0.1,
  });
  expect(model.model).toBe("llama-3.3-70b-versatile");
  expect(model.temperature).toBe(0.1);
});

test("messageToGroqRole", () => {
  // Test generic messages (ChatMessage type = "generic") with valid roles
  // These test the extractGenericMessageCustomRole path
  const genericUser = new ChatMessage("Hello, world!", "user");
  expect(messageToGroqRole(genericUser)).toBe("user");

  const genericAssistant = new ChatMessage("Hello, world!", "assistant");
  expect(messageToGroqRole(genericAssistant)).toBe("assistant");

  const genericSystem = new ChatMessage("Hello, world!", "system");
  expect(messageToGroqRole(genericSystem)).toBe("system");

  const genericFunction = new ChatMessage("Hello, world!", "function");
  expect(messageToGroqRole(genericFunction)).toBe("function");

  // Test generic message with tool role - should throw via extractGenericMessageCustomRole
  const genericTool = new ChatMessage("Hello, world!", "tool");
  expect(() => messageToGroqRole(genericTool)).toThrow(
    'Unsupported message role: tool. Expected "system", "assistant", "user", or "function"'
  );

  // Test generic message with invalid role - should throw via extractGenericMessageCustomRole
  const genericInvalid = new ChatMessage("Invalid message", "invalid");
  expect(() => messageToGroqRole(genericInvalid)).toThrow(
    'Unsupported message role: invalid. Expected "system", "assistant", "user", or "function"'
  );

  // Test generic message with custom role that's not supported
  const genericCustom = new ChatMessage("Custom message", "custom-role");
  expect(() => messageToGroqRole(genericCustom)).toThrow(
    'Unsupported message role: custom-role. Expected "system", "assistant", "user", or "function"'
  );
});

describe("reasoningEffort", () => {
  test("passes reasoning_effort through invocationParams", () => {
    const model = new ChatGroq({
      apiKey: "foo",
      model: "openai/gpt-oss-120b",
      reasoningEffort: "low",
    });
    const params = model.invocationParams({});
    expect(params.reasoning_effort).toBe("low");
  });

  test("supports override via call options", () => {
    const model = new ChatGroq({
      apiKey: "foo",
      model: "openai/gpt-oss-120b",
      reasoningEffort: "low",
    });
    const params = model.invocationParams({ reasoning_effort: "high" });
    expect(params.reasoning_effort).toBe("high");
  });

  test("is undefined when not set", () => {
    const model = new ChatGroq({
      apiKey: "foo",
      model: "llama-3.3-70b-versatile",
    });
    const params = model.invocationParams({});
    expect(params.reasoning_effort).toBeUndefined();
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
    const model = new ChatGroq({
      model: "llama-3.3-70b-versatile",
      apiKey: "testing",
    });
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
      name: "extract",
    });

    const result = await structured.invoke("What?");
    expect(result).toEqual({ name: "cobalt" });
  });

  test("functionCalling with invalid output throws OutputParserException", async () => {
    const model = new ChatGroq({
      model: "llama-3.3-70b-versatile",
      apiKey: "testing",
    });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(
        new AIMessageChunk({
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
      name: "extract",
    });

    await expect(async () => {
      await structured.invoke("What?");
    }).rejects.toThrow(OutputParserException);
  });

  test("functionCalling with custom name", async () => {
    const model = new ChatGroq({
      model: "llama-3.3-70b-versatile",
      apiKey: "testing",
    });
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
    const model = new ChatGroq({
      model: "llama-3.3-70b-versatile",
      apiKey: "testing",
    });
    vi
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(mockResponse);

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      method: "functionCalling",
      name: "extract",
      includeRaw: true,
    });

    const result = await structured.invoke("What?");
    expect(result).toHaveProperty("raw");
    expect(result).toHaveProperty("parsed");
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).parsed).toEqual({ name: "cobalt" });
  });
});
