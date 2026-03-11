import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { BedrockChat } from "../bedrock/index.js";

class BedrockChatStandardIntegrationTests extends ChatModelIntegrationTests<
  BaseChatModelCallOptions,
  AIMessageChunk
> {
  constructor() {
    const region = process.env.BEDROCK_AWS_REGION ?? "us-east-1";
    super({
      Cls: BedrockChat,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      supportsParallelToolCalls: true,
      constructorArgs: {
        region,
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        credentials: {
          secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY,
          accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID,
        },
      },
    });
  }

  async testUsageMetadataStreaming() {
    this.skipTestMessage(
      "testUsageMetadataStreaming",
      "BedrockChat",
      "Streaming tokens is not currently supported."
    );
  }

  async testUsageMetadata() {
    this.skipTestMessage(
      "testUsageMetadata",
      "BedrockChat",
      "Usage metadata tokens is not currently supported."
    );
  }

  async testStreamTokensWithToolCalls() {
    this.skipTestMessage(
      "testStreamTokensWithToolCalls",
      "BedrockChat",
      "Flaky test with Bedrock not consistently returning tool calls. TODO: Fix prompting."
    );
  }

  async testModelCanUseToolUseAIMessageWithStreaming() {
    this.skipTestMessage(
      "testModelCanUseToolUseAIMessageWithStreaming",
      "BedrockChat",
      "Flaky test with Bedrock not consistently returning tool calls. TODO: Fix prompting."
    );
  }

  async testParallelToolCalling() {
    // Anthropic is very flaky when calling multiple tools in parallel.
    // Because of this, we pass `true` as the second arg to only verify
    // it can handle parallel tools in the message history.
    await super.testParallelToolCalling(undefined, true);
  }
}

const testClass = new BedrockChatStandardIntegrationTests();

test("BedrockChatStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
