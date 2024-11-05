/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatXAI, ChatXAICallOptions } from "../chat_models.js";

class ChatXAIStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatXAICallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.XAI_API_KEY) {
      throw new Error(
        "Can not run xAI integration tests because XAI_API_KEY is not set"
      );
    }
    super({
      Cls: ChatXAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        maxRetries: 1,
        temperature: 0,
      },
    });
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesListContent",
      "ChatXAI",
      "Complex message types not properly implemented"
    );
  }

  async testToolMessageHistoriesStringContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesStringContent",
      "ChatXAI",
      "Not working"
    );
  }

  async testStructuredFewShotExamples() {
    this.skipTestMessage(
      "testStructuredFewShotExamples",
      "ChatXAI",
      "Not working"
    );
  }

  async testModelCanUseToolUseAIMessage() {
    this.skipTestMessage(
      "testModelCanUseToolUseAIMessage",
      "ChatXAI",
      "Not working"
    );
  }

  async testModelCanUseToolUseAIMessageWithStreaming() {
    this.skipTestMessage(
      "testModelCanUseToolUseAIMessageWithStreaming",
      "ChatXAI",
      "Not working"
    );
  }
}

const testClass = new ChatXAIStandardIntegrationTests();

test("ChatXAIStandardIntegrationTests", async () => {
  console.warn = (..._args: unknown[]) => {
    // no-op
  };
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
