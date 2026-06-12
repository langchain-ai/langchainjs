import { test, expect, describe } from "vitest";
import type { CodeExecutionTool } from "@google/generative-ai";
import { AIMessage } from "@langchain/core/messages";
import { convertBaseMessagesToContent } from "../utils/common.js";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { convertToolsToGenAI } from "../utils/tools.js";

test("converts standard tool_call content blocks to Google functionCall format", () => {
  // Create AIMessage with standard tool_call content block
  const aiMessage = new AIMessage({
    contentBlocks: [
      {
        type: "tool_call",
        id: "call_123",
        name: "calculator",
        args: {
          operation: "add",
          number1: 2,
          number2: 3,
        },
      },
    ],
  });

  // Convert to Google GenAI format
  const result = convertBaseMessagesToContent(
    [aiMessage],
    false, // isMultimodalModel
    undefined,
    "gemini-1.5-flash"
  );

  // Verify correct conversion
  expect(result).toBeDefined();
  expect(result.length).toBe(1);
  const part = result[0].parts[0];

  expect(part.functionCall).toBeDefined();
  expect(part.functionCall?.name).toBe("calculator");
  expect(part.functionCall?.args).toEqual({
    operation: "add",
    number1: 2,
    number2: 3,
  });
});

test("merges LangChain tool declarations into native Gemini tools", () => {
  const codeExecutionTool: CodeExecutionTool = {
    codeExecution: {},
  };
  const lookupTool = tool(async () => "ok", {
    name: "lookup_record",
    description: "Looks up a record by ID.",
    schema: z.object({
      id: z.string().describe("Record ID"),
    }),
  });

  const result = convertToolsToGenAI([codeExecutionTool, lookupTool]);

  expect(result.tools).toHaveLength(1);
  expect(result.tools[0]).toMatchObject({
    codeExecution: {},
  });
  expect("functionDeclarations" in result.tools[0]).toBe(true);
  if (!("functionDeclarations" in result.tools[0])) return;
  expect(result.tools[0].functionDeclarations).toHaveLength(1);
  expect(result.tools[0].functionDeclarations?.[0].name).toBe("lookup_record");
});

test("preserves empty and declaration-only Gemini tool lists", () => {
  expect(convertToolsToGenAI([]).tools).toEqual([]);

  const lookupTool = tool(async () => "ok", {
    name: "lookup_record",
    description: "Looks up a record by ID.",
    schema: z.object({
      id: z.string().describe("Record ID"),
    }),
  });

  const result = convertToolsToGenAI([lookupTool]);

  expect(result.tools).toHaveLength(1);
  expect("functionDeclarations" in result.tools[0]).toBe(true);
  if (!("functionDeclarations" in result.tools[0])) return;
  expect(result.tools[0].functionDeclarations).toHaveLength(1);
  expect(result.tools[0].functionDeclarations?.[0].name).toBe("lookup_record");
});

describe("Gemini Tool Schema Validation - Empty String in Enum", () => {
  test("should throw descriptive error for empty string in z.enum", () => {
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash-exp",
      apiKey: "fake-api-key",
    });

    const schema = z.object({
      status: z.enum(["", "active", "inactive"]).describe("Status value"),
    });

    const crashTool = tool(async (_input: z.infer<typeof schema>) => "ok", {
      name: "crash_tool",
      description: "This tool will crash Gemini SDK",
      schema: schema,
    });

    expect(() => model.bindTools([crashTool])).toThrow(
      /Invalid enum: empty string not allowed/
    );
  });

  test("should throw descriptive error for empty string in z.nativeEnum", () => {
    enum TestEnum {
      A = "",
      B = "active",
      C = "inactive",
    }

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash-exp",
      apiKey: "fake-api-key",
    });

    const schema = z.object({
      status: z.nativeEnum(TestEnum).describe("Status value"),
    });

    const crashTool = tool(async (_input: z.infer<typeof schema>) => "ok", {
      name: "crash_tool",
      description: "This tool will crash Gemini SDK",
      schema: schema,
    });

    expect(() => model.bindTools([crashTool])).toThrow(
      /Invalid enum: empty string not allowed/
    );
  });
});
