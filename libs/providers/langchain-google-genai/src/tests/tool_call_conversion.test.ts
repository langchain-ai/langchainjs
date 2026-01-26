import { test, expect } from "@jest/globals";
import { AIMessage } from "@langchain/core/messages";
import { convertBaseMessagesToContent } from "../utils/common.js";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

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

describe('Gemini Tool Schema Validation - Empty String in Enum', () => {
  test('should throw descriptive error for empty string in z.enum', () => { 
    const model = new ChatGoogleGenerativeAI({ 
      model: "gemini-2.0-flash-exp" 
    });

    const schema = z.object({
      status: z.enum(["", "active", "inactive"]).describe("Status value")
    });

    const crashTool = tool(
      async (_input: z.infer<typeof schema>) => "ok",
      {
        name: "crash_tool",
        description: "This tool will crash Gemini SDK",
        schema: schema
      }
    );

    // ← Test at bindTools, not invoke
    expect(() => model.bindTools([crashTool]))
      .toThrow(/Invalid enum: empty string not allowed/);
  }); // ← Remove timeout, it's synchronous now

  test('should throw descriptive error for empty string in z.nativeEnum', () => {  
    enum TestEnum {
      A = "",
      B = "active",
      C = "inactive"
    }

    const model = new ChatGoogleGenerativeAI({ 
      model: "gemini-2.0-flash-exp" 
    });

    const schema = z.object({
      status: z.nativeEnum(TestEnum).describe("Status value")
    });

    const crashTool = tool(
      async (_input: z.infer<typeof schema>) => "ok",
      {
        name: "crash_tool",
        description: "This tool will crash Gemini SDK",
        schema: schema
      }
    );

    // ← Test at bindTools, not invoke
    expect(() => model.bindTools([crashTool]))
      .toThrow(/Invalid enum: empty string not allowed/);
  }); // ← Remove timeout
});