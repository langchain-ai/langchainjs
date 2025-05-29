import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatMistralAI } from "../chat_models.js";
import {
  _isValidMistralToolCallId,
  _convertToolCallIdToMistralCompatible,
  _mistralContentChunkToMessageContentComplex,
} from "../utils.js";

describe("Mistral Tool Call ID Conversion", () => {
  test("valid and invalid Mistral tool call IDs", () => {
    expect(_isValidMistralToolCallId("ssAbar4Dr")).toBe(true);
    expect(_isValidMistralToolCallId("abc123")).toBe(false);
    expect(_isValidMistralToolCallId("call_JIIjI55tTipFFzpcP8re3BpM")).toBe(
      false
    );
  });

  test("tool call ID conversion", () => {
    const resultMap: Record<string, string> = {
      ssAbar4Dr: "ssAbar4Dr",
      abc123: "0001yoN1K",
      call_JIIjI55tTipFFzpcP8re3BpM: "0001sqrj5",
      12345: "00003akVR",
    };

    for (const [inputId, expectedOutput] of Object.entries(resultMap)) {
      const convertedId = _convertToolCallIdToMistralCompatible(inputId);
      expect(convertedId).toBe(expectedOutput);
      expect(_isValidMistralToolCallId(convertedId)).toBe(true);
    }
  });
});

test("Tool conversion handles both Zod schemas and JSON schemas", () => {
  const model = new ChatMistralAI({ apiKey: "test" });
  const zodTool = {
    name: "zodTool",
    description: "A tool with Zod schema",
    schema: z.object({
      input: z.string().describe("Input parameter"),
    }),
  };
  const jsonSchemaTool = {
    name: "jsonSchemaTool",
    description: "A tool with JSON schema",
    schema: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "Input parameter",
        },
      },
      required: ["input"],
    },
  };

  expect(() => {
    const modelWithTools = model.bindTools([zodTool, jsonSchemaTool]);
    expect(modelWithTools).toBeDefined();
  }).not.toThrow();

  const mcpLikeTool = new DynamicStructuredTool({
    name: "mcpLikeTool",
    description: "Tool similar to MCP tools",
    schema: {
      type: "object",
      properties: {
        city: { type: "string" },
      },
      required: ["city"],
    },
    func: async () => "test result",
  });

  // This should also not throw an error
  expect(() => {
    const modelWithMcpTool = model.bindTools([mcpLikeTool]);
    expect(modelWithMcpTool).toBeDefined();
  }).not.toThrow();
});

test("Serialization", () => {
  const model = new ChatMistralAI({
    apiKey: "foo",
  });
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","mistralai","ChatMistralAI"],"kwargs":{"mistral_api_key":{"lc":1,"type":"secret","id":["MISTRAL_API_KEY"]}}}`
  );
});
