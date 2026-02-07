import { test, expect } from "@jest/globals";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { convertBaseMessagesToContent } from "../utils/common.js";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { ContentBlock } from "@langchain/core/messages";

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

describe("Gemini Tool Schema Validation - Empty String in Enum", () => {
  test("should throw descriptive error for empty string in z.enum", () => {
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash-exp",
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

describe("ContentBlock.Multimodal support", () => {
  test("should handle ContentBlock.Multimodal.Image", () => {
    const humanMessage = new HumanMessage({
      contentBlocks: [
        {
          type: "text",
          text: "what is this a picture of?",
        } satisfies ContentBlock.Text,
        {
          type: "image",
          data: "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
          mimeType: "image/jpeg",
          metadata: {
            filename: "image.jpg",
          },
        } satisfies ContentBlock.Multimodal.Image &
          ContentBlock.Multimodal.DataRecordBase64,
      ],
    });

    // This should not throw "Unknown content type image"
    expect(() =>
      convertBaseMessagesToContent(
        [humanMessage],
        true, // isMultimodalModel
        undefined,
        "gemini-1.5-flash"
      )
    ).not.toThrow();
  });

  test("should handle ContentBlock.Multimodal.File (PDF)", () => {
    const humanMessage = new HumanMessage({
      contentBlocks: [
        {
          type: "text",
          text: "analyze this file",
        } satisfies ContentBlock.Text,
        {
          type: "file",
          data: "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKMiAwIG9iago8PAovVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKPj4KZW5kb2JqCnhyZWYKMCA0CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMTMgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA0Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgoxNjIKJSVFT0YK",
          mimeType: "application/pdf",
          metadata: {
            filename: "document.pdf",
          },
        } satisfies ContentBlock.Multimodal.File &
          ContentBlock.Multimodal.DataRecordBase64,
      ],
    });

    // This should not throw "Unknown content type file"
    expect(() =>
      convertBaseMessagesToContent(
        [humanMessage],
        true, // isMultimodalModel
        undefined,
        "gemini-1.5-flash"
      )
    ).not.toThrow();
  });

  test("should convert image to Google GenAI inlineData format", () => {
    const humanMessage = new HumanMessage({
      contentBlocks: [
        {
          type: "image",
          data: "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
          mimeType: "image/jpeg",
        } satisfies ContentBlock.Multimodal.Image &
          ContentBlock.Multimodal.DataRecordBase64,
      ],
    });

    const result = convertBaseMessagesToContent(
      [humanMessage],
      true,
      undefined,
      "gemini-1.5-flash"
    );

    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    const part = result[0].parts[0];
    expect(part.inlineData).toBeDefined();
    expect(part.inlineData?.mimeType).toBe("image/jpeg");
    expect(part.inlineData?.data).toBe(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="
    );
  });
});
