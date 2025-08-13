/* eslint-disable no-process-env */
import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
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
testClass.runTests("ChatCloudflareWorkersAIStandardIntegrationTests");
