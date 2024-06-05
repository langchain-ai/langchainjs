/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatCohere, CohereChatCallOptions } from "../chat_models.js";

class ChatCohereStandardIntegrationTests extends ChatModelIntegrationTests<
  CohereChatCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.COHERE_API_KEY) {
      throw new Error(
        "Can not run Cohere integration tests because COHERE_API_KEY is not set"
      );
    }
    super({
      Cls: ChatCohere,
      chatModelHasToolCalling: false,
      chatModelHasStructuredOutput: false,
      constructorArgs: {},
    });
  }

  async testUsageMetadataStreaming() {
    this.skipTestMessage(
      "testUsageMetadataStreaming",
      "ChatCohere",
      "Streaming tokens is not currently supported."
    );
  }

  async testUsageMetadata() {
    this.skipTestMessage(
      "testUsageMetadata",
      "ChatCohere",
      "Usage metadata tokens is not currently supported."
    );
  }
}

const testClass = new ChatCohereStandardIntegrationTests();

test("ChatCohereStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
