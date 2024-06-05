/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIChatCallOptions,
} from "../chat_models.js";

class ChatGoogleGenerativeAIStandardIntegrationTests extends ChatModelIntegrationTests<
  GoogleGenerativeAIChatCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error(
        "Can not run Google Generative AI integration tests because GOOGLE_API_KEY is set"
      );
    }
    super({
      Cls: ChatGoogleGenerativeAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        maxRetries: 1,
      },
    });
  }

  async testUsageMetadataStreaming() {
    this.skipTestMessage(
      "testUsageMetadataStreaming",
      "ChatGoogleGenerativeAI",
      "Streaming tokens is not currently supported."
    );
  }

  async testUsageMetadata() {
    this.skipTestMessage(
      "testUsageMetadata",
      "ChatGoogleGenerativeAI",
      "Usage metadata tokens is not currently supported."
    );
  }

  async testToolMessageHistoriesStringContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesStringContent",
      "ChatGoogleGenerativeAI",
      "Not implemented."
    );
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesListContent",
      "ChatGoogleGenerativeAI",
      "Not implemented."
    );
  }

  async testStructuredFewShotExamples() {
    this.skipTestMessage(
      "testStructuredFewShotExamples",
      "ChatGoogleGenerativeAI",
      ".bindTools not implemented properly."
    );
  }
}

const testClass = new ChatGoogleGenerativeAIStandardIntegrationTests();

test("ChatGoogleGenerativeAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
