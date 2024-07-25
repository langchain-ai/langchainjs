/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatGroq, ChatGroqCallOptions } from "../chat_models.js";

class ChatGroqStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatGroqCallOptions,
  AIMessageChunk
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
        model: "llama3-groq-70b-8192-tool-use-preview",
      },
    });
  }

  async testUsageMetadataStreaming() {
    this.skipTestMessage(
      "testUsageMetadataStreaming",
      "ChatGroq",
      "Streaming tokens is not currently supported."
    );
  }

  async testUsageMetadata() {
    this.skipTestMessage(
      "testUsageMetadata",
      "ChatGroq",
      "Usage metadata tokens is not currently supported."
    );
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
}

const testClass = new ChatGroqStandardIntegrationTests();

test("ChatGroqStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
