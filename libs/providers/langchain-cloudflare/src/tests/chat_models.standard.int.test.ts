/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatCloudflareWorkersAI,
  ChatCloudflareWorkersAICallOptions,
} from "../chat_models.js";

class ChatCloudflareWorkersAIStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatCloudflareWorkersAICallOptions,
  AIMessageChunk
> {
  constructor() {
    if (
      !process.env.CLOUDFLARE_ACCOUNT_ID ||
      !process.env.CLOUDFLARE_API_TOKEN
    ) {
      throw new Error(
        "Skipping Cloudflare Workers AI integration tests because CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is not set"
      );
    }
    super({
      Cls: ChatCloudflareWorkersAI,
      chatModelHasToolCalling: false,
      chatModelHasStructuredOutput: false,
      constructorArgs: {},
    });
  }

  async testUsageMetadataStreaming() {
    this.skipTestMessage(
      "testUsageMetadataStreaming",
      "ChatCloudflareWorkersAI",
      "Streaming tokens is not currently supported."
    );
  }

  async testUsageMetadata() {
    this.skipTestMessage(
      "testUsageMetadata",
      "ChatCloudflareWorkersAI",
      "Usage metadata tokens is not currently supported."
    );
  }
}

const testClass = new ChatCloudflareWorkersAIStandardIntegrationTests();

test("ChatCloudflareWorkersAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
