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
}

const testClass = new ChatGroqStandardIntegrationTests();

test("ChatGroqStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
