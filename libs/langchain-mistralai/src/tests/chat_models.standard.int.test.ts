/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatMistralAI, MistralAICallOptions } from "../chat_models.js";

class ChatMistralAIStandardIntegrationTests extends ChatModelIntegrationTests<
  MistralAICallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.MISTRAL_API_KEY) {
      throw new Error(
        "Can not run Mistral AI integration tests because MISTRAL_API_KEY is not set"
      );
    }
    super({
      Cls: ChatMistralAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
      // Mistral requires function call IDs to be a-z, A-Z, 0-9, with a length of 9.
      functionId: "123456789",
    });
  }

  async testUsageMetadataStreaming() {
    this.skipTestMessage(
      "testUsageMetadataStreaming",
      "ChatMistralAI",
      "Streaming tokens is not currently supported."
    );
  }

  async testUsageMetadata() {
    this.skipTestMessage(
      "testUsageMetadata",
      "ChatMistralAI",
      "Usage metadata tokens is not currently supported."
    );
  }
}

const testClass = new ChatMistralAIStandardIntegrationTests();

test("ChatMistralAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
