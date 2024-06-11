/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { GoogleAIBaseLanguageModelCallOptions } from "@langchain/google-common";
import { ChatVertexAI } from "../chat_models.js";

class ChatVertexAIStandardIntegrationTests extends ChatModelIntegrationTests<
  GoogleAIBaseLanguageModelCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS must be set to run standard integration tests."
      );
    }
    super({
      Cls: ChatVertexAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "gemini-1.5-pro",
      },
    });
  }

  async testUsageMetadataStreaming() {
    this.skipTestMessage(
      "testUsageMetadataStreaming",
      "ChatVertexAI",
      "Streaming tokens is not currently supported."
    );
  }

  async testUsageMetadata() {
    this.skipTestMessage(
      "testUsageMetadata",
      "ChatVertexAI",
      "Usage metadata tokens is not currently supported."
    );
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesListContent",
      "ChatVertexAI",
      "Not implemented."
    );
  }
}

const testClass = new ChatVertexAIStandardIntegrationTests();

test("ChatVertexAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
