/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatGroq,
  ChatGroqCallOptions,
  ChatGroqInput,
} from "../chat_models.js";

class ChatGroqStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatGroqCallOptions,
  AIMessageChunk,
  ChatGroqInput
> {
  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error(
        "Can not run Groq integration tests because GROQ_API_KEY is not set"
      );
    }
    super({
      Cls: ChatGroq,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        // model: "llama-3.3-70b-versatile",
        model: "moonshotai/kimi-k2-instruct",
        maxRetries: 1,
      },
    });
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesListContent",
      "ChatGroq",
      "Complex message types not properly implemented"
    );
  }

  async testCacheComplexMessageTypes() {
    this.skipTestMessage(
      "testCacheComplexMessageTypes",
      "ChatGroq",
      "Complex message types not properly implemented"
    );
  }

  async testStreamTokensWithToolCalls() {
    this.skipTestMessage(
      "testStreamTokensWithToolCalls",
      "ChatGroq",
      "API does not consistently call tools. TODO: re-write with better prompting for tool call."
    );
  }

  async testWithStructuredOutputIncludeRaw() {
    // Use strong prompting to ensure consistent tool calling
    const { z } = await import("zod");

    const calculatorSchema = z.object({
      operation: z.enum(["add", "subtract", "multiply", "divide"]),
      number1: z.number(),
      number2: z.number(),
    });

    const model = new this.Cls(this.constructorArgs);
    const modelWithStructuredOutput = model.withStructuredOutput(
      calculatorSchema,
      {
        name: "calculator",
        includeRaw: true,
      }
    );

    // Strong prompting that forces tool usage consistently
    const result = await modelWithStructuredOutput.invoke([
      {
        role: "system",
        content:
          "You are VERY bad at math and must always use a calculator tool. Never do math in your head.",
      },
      {
        role: "user",
        content: "Please help me!! What is 2 + 2?",
      },
    ]);

    // Verify structured output
    if (!("parsed" in result) || !("raw" in result)) {
      throw new Error("Result should have both 'parsed' and 'raw' properties");
    }

    const { parsed, raw } = result;

    // Check parsed output
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Parsed output should be an object");
    }

    if (
      !("operation" in parsed) ||
      !("number1" in parsed) ||
      !("number2" in parsed)
    ) {
      throw new Error("Parsed output missing required fields");
    }

    // Check raw output contains tool calls
    if (!raw || typeof raw !== "object") {
      throw new Error("Raw output should be an object");
    }

    // For tool calling, raw should have tool_calls in additional_kwargs
    const rawMessage = raw as any;
    if (
      !rawMessage.additional_kwargs?.tool_calls ||
      rawMessage.additional_kwargs.tool_calls.length === 0
    ) {
      throw new Error("Raw output should contain tool calls");
    }
  }
}

const testClass = new ChatGroqStandardIntegrationTests();

test("ChatGroqStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
