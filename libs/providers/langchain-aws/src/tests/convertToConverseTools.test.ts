import { describe, it, expect } from "vitest";
import {
  convertToConverseTools,
  supportedToolChoiceValuesForModel,
} from "../utils/tools.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v3";

describe("convertToConverseTools", () => {
  it("should handle mixed tool types (LangChain + OpenAI format)", () => {
    // Create a LangChain tool (like from tool() function)
    const langchainTool = tool(
      ({ operation, args }) => {
        if (operation === "add") {
          return { answer: args.a + args.b };
        }
        throw new Error(`Unknown operation: ${operation}`);
      },
      {
        name: "calculate",
        description: "Calculate the result of an operation",
        schema: z.object({
          operation: z.enum(["add"]),
          args: z.object({
            a: z.number(),
            b: z.number(),
          }),
        }),
      }
    );

    // Create an OpenAI format tool (like structured output tools from ToolStrategy)
    // This is what createAgent adds when responseFormat is used
    const openAITool = {
      type: "function" as const,
      function: {
        name: "extract-1",
        description:
          "Tool for extracting structured output from the model's response.",
        parameters: {
          type: "object",
          properties: {
            answer: { type: "number" },
          },
          required: ["answer"],
        },
      },
    };

    // Test mixed array - this is what createAgent with responseFormat creates
    const mixedTools = [langchainTool, openAITool];

    // This should not throw an error
    const result = convertToConverseTools(mixedTools);

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty("toolSpec");
    expect(result[0].toolSpec.name).toBe("calculate");
    expect(result[0].toolSpec.description).toBe(
      "Calculate the result of an operation"
    );
    expect(result[1]).toHaveProperty("toolSpec");
    expect(result[1].toolSpec.name).toBe("extract-1");
    expect(result[1].toolSpec.description).toBe(
      "Tool for extracting structured output from the model's response."
    );
  });

  it("should handle all LangChain tools", () => {
    const tool1 = tool((input: string) => `Result: ${input}`, {
      name: "tool1",
      description: "First tool",
      schema: z.string(),
    });

    const tool2 = tool((input: string) => `Result: ${input}`, {
      name: "tool2",
      description: "Second tool",
      schema: z.string(),
    });

    const result = convertToConverseTools([tool1, tool2]);

    expect(result).toHaveLength(2);
    expect(result[0].toolSpec.name).toBe("tool1");
    expect(result[0].toolSpec.description).toBe("First tool");
    expect(result[1].toolSpec.name).toBe("tool2");
    expect(result[1].toolSpec.description).toBe("Second tool");
  });

  it("should handle all OpenAI format tools", () => {
    const openAITool1 = {
      type: "function" as const,
      function: {
        name: "extract-1",
        description: "First extract tool",
        parameters: {
          type: "object",
          properties: {
            value: { type: "string" },
          },
        },
      },
    };

    const openAITool2 = {
      type: "function" as const,
      function: {
        name: "extract-2",
        description: "Second extract tool",
        parameters: {
          type: "object",
          properties: {
            value: { type: "number" },
          },
        },
      },
    };

    const result = convertToConverseTools([openAITool1, openAITool2]);

    expect(result).toHaveLength(2);
    expect(result[0].toolSpec.name).toBe("extract-1");
    expect(result[0].toolSpec.description).toBe("First extract tool");
    expect(result[1].toolSpec.name).toBe("extract-2");
    expect(result[1].toolSpec.description).toBe("Second extract tool");
  });

  it("should handle Bedrock tools", () => {
    const bedrockTool = {
      toolSpec: {
        name: "bedrock-tool",
        description: "A Bedrock tool",
        inputSchema: {
          json: {
            type: "object",
            properties: {
              input: { type: "string" },
            },
          },
        },
      },
    };

    const result = convertToConverseTools([bedrockTool]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(bedrockTool);
  });

  it("should handle empty array", () => {
    const result = convertToConverseTools([]);
    expect(result).toHaveLength(0);
  });

  it("should throw error for invalid tool with helpful message", () => {
    const invalidTool = { invalid: "tool" };

    expect(() => convertToConverseTools([invalidTool])).toThrow(
      "Invalid tool passed at index 0"
    );
  });

  it("should handle complex mixed scenario (multiple LangChain + multiple OpenAI tools)", () => {
    const langchainTool1 = tool((input: string) => input, {
      name: "langchain-1",
      description: "First LangChain tool",
      schema: z.string(),
    });

    const langchainTool2 = tool((input: number) => input, {
      name: "langchain-2",
      description: "Second LangChain tool",
      schema: z.number(),
    });

    const openAITool1 = {
      type: "function" as const,
      function: {
        name: "openai-1",
        description: "First OpenAI tool",
        parameters: {
          type: "object",
          properties: {
            foo: { type: "string" },
          },
        },
      },
    };

    const openAITool2 = {
      type: "function" as const,
      function: {
        name: "openai-2",
        description: "Second OpenAI tool",
        parameters: {
          type: "object",
          properties: {
            bar: { type: "number" },
          },
        },
      },
    };

    // Mix them in different orders
    const mixedTools = [
      langchainTool1,
      openAITool1,
      langchainTool2,
      openAITool2,
    ];

    const result = convertToConverseTools(mixedTools);

    expect(result).toHaveLength(4);
    expect(result[0].toolSpec.name).toBe("langchain-1");
    expect(result[1].toolSpec.name).toBe("openai-1");
    expect(result[2].toolSpec.name).toBe("langchain-2");
    expect(result[3].toolSpec.name).toBe("openai-2");
  });
});

describe("supportedToolChoiceValuesForModel", () => {
  const CLAUDE_TOOL_CHOICES: Array<"auto" | "any" | "tool"> = [
    "auto",
    "any",
    "tool",
  ];

  it("returns tool choice values for Claude 3 models", () => {
    expect(
      supportedToolChoiceValuesForModel(
        "anthropic.claude-3-sonnet-20240229-v1:0"
      )
    ).toEqual(CLAUDE_TOOL_CHOICES);
    expect(
      supportedToolChoiceValuesForModel(
        "anthropic.claude-3-5-haiku-20241022-v1:0"
      )
    ).toEqual(CLAUDE_TOOL_CHOICES);
  });

  it("returns tool choice values for Claude Sonnet 4 models", () => {
    expect(
      supportedToolChoiceValuesForModel(
        "anthropic.claude-sonnet-4-5-20250929-v1:0"
      )
    ).toEqual(CLAUDE_TOOL_CHOICES);
  });

  it("returns tool choice values for Claude Opus 4 models", () => {
    expect(
      supportedToolChoiceValuesForModel("anthropic.claude-opus-4-20250514-v1:0")
    ).toEqual(CLAUDE_TOOL_CHOICES);
  });

  it("returns tool choice values for Claude Haiku 4 models", () => {
    expect(
      supportedToolChoiceValuesForModel(
        "anthropic.claude-haiku-4-5-20251001-v1:0"
      )
    ).toEqual(CLAUDE_TOOL_CHOICES);
  });

  it("returns tool choice values for Claude Haiku 4 regional inference profiles", () => {
    expect(
      supportedToolChoiceValuesForModel(
        "eu.anthropic.claude-haiku-4-5-20251001-v1:0"
      )
    ).toEqual(CLAUDE_TOOL_CHOICES);
    expect(
      supportedToolChoiceValuesForModel(
        "us.anthropic.claude-haiku-4-5-20251001-v1:0"
      )
    ).toEqual(CLAUDE_TOOL_CHOICES);
    expect(
      supportedToolChoiceValuesForModel(
        "ap.anthropic.claude-haiku-4-5-20251001-v1:0"
      )
    ).toEqual(CLAUDE_TOOL_CHOICES);
  });

  it("returns tool choice values for other Claude 4 regional inference profiles", () => {
    expect(
      supportedToolChoiceValuesForModel(
        "eu.anthropic.claude-sonnet-4-5-20250929-v1:0"
      )
    ).toEqual(CLAUDE_TOOL_CHOICES);
    expect(
      supportedToolChoiceValuesForModel(
        "us.anthropic.claude-opus-4-20250514-v1:0"
      )
    ).toEqual(CLAUDE_TOOL_CHOICES);
  });

  it("returns tool choice values for Mistral Large models", () => {
    expect(
      supportedToolChoiceValuesForModel("mistral.mistral-large-2407-v1:0")
    ).toEqual(["auto", "any"]);
  });

  it("returns undefined for Claude 2 and other unsupported models", () => {
    expect(
      supportedToolChoiceValuesForModel("anthropic.claude-v2")
    ).toBeUndefined();
    expect(
      supportedToolChoiceValuesForModel("cohere.command-text-v14")
    ).toBeUndefined();
    expect(
      supportedToolChoiceValuesForModel("mistral.mistral-7b-instruct-v0:2")
    ).toBeUndefined();
  });
});
