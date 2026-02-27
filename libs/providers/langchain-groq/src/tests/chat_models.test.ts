import { vi, test, expect, describe } from "vitest";
import { AIMessage, ChatMessage } from "@langchain/core/messages";
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
    const model = new ChatGroq({
      model: "llama-3.3-70b-versatile",
      apiKey: "testing",
    });
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
    const modelWithStructuredOutput = model.withStructuredOutput(schema);

    const result = await modelWithStructuredOutput.invoke("What is your name?");
    expect(result).toEqual({ name: "Claude" });
  });

  test("functionCalling with invalid output throws OutputParserException", async () => {
    const model = new ChatGroq({
      model: "llama-3.3-70b-versatile",
      apiKey: "testing",
    });
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
    const modelWithStructuredOutput = model.withStructuredOutput(schema);

    await expect(async () => {
      await modelWithStructuredOutput.invoke("What is your name?");
    }).rejects.toThrow(OutputParserException);
  });

  test("functionCalling with custom name", async () => {
    const model = new ChatGroq({
      model: "llama-3.3-70b-versatile",
      apiKey: "testing",
    });
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
    const model = new ChatGroq({
      model: "llama-3.3-70b-versatile",
      apiKey: "testing",
    });
    vi.spyOn(model as any, "invoke").mockResolvedValue(rawMessage);

    const schema = makeSerializableSchema();
    const modelWithStructuredOutput = model.withStructuredOutput(schema, {
      includeRaw: true,
    });

    const result = await modelWithStructuredOutput.invoke("Tell me a name");
    expect(result).toHaveProperty("raw");
    expect(result).toHaveProperty("parsed");
    expect(result.parsed).toEqual({ name: "Bob" });
  });
});
