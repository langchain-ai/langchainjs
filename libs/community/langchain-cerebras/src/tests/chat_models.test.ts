import { test, expect, describe, jest } from "@jest/globals";
import { AIMessage } from "@langchain/core/messages";
import { ChatCerebras } from "../chat_models.js";

test("constructor supports string model shorthand", () => {
  const llm = new ChatCerebras("llama-3.3-70b", {
    apiKey: "test-api-key",
    temperature: 0.2,
  });

  expect(llm.model).toBe("llama-3.3-70b");
  expect(llm.temperature).toBe(0.2);

  const llmWithParams = new ChatCerebras({
    model: "llama-3.3-70b",
    apiKey: "test-api-key",
  });

  expect(llmWithParams.model).toBe("llama-3.3-70b");
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
    const model = new ChatCerebras({
      model: "llama-3.3-70b",
      apiKey: "testing",
    });
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const structured = model.withStructuredOutput(schema);

    const result = await structured.invoke("What?");
    expect(result).toEqual({ name: "cobalt" });
  });

  test("functionCalling with custom name", async () => {
    const model = new ChatCerebras({
      model: "llama-3.3-70b",
      apiKey: "testing",
    });
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const model = new ChatCerebras({
      model: "llama-3.3-70b",
      apiKey: "testing",
    });
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(mockResponse);

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema, {
      includeRaw: true,
    });

    const result = await structured.invoke("What?");
    expect(result).toHaveProperty("raw");
    expect(result).toHaveProperty("parsed");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).parsed).toEqual({ name: "cobalt" });
  });

  test("no tool calls throws error", async () => {
    const model = new ChatCerebras({
      model: "llama-3.3-70b",
      apiKey: "testing",
    });
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn(model as any, "invoke")
      .mockResolvedValue(new AIMessage({ content: "No tools here" }));

    const schema = makeSerializableSchema();
    const structured = model.withStructuredOutput(schema);

    await expect(async () => {
      await structured.invoke("What?");
    }).rejects.toThrow("No tool calls found in the response.");
  });
});
