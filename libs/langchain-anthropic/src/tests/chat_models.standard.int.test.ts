/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatAnthropic, ChatAnthropicCallOptions } from "../chat_models.js";

class ChatAnthropicStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatAnthropicCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY must be set to run standard integration tests."
      );
    }
    super({
      Cls: ChatAnthropic,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "claude-3-haiku-20240307",
      },
    });
  }

  async testUsageMetadataStreaming() {
    console.warn(
      "Skipping testUsageMetadataStreaming, not implemented in ChatAnthropic."
    );
  }
}

const testClass = new ChatAnthropicStandardIntegrationTests();

test("ChatAnthropicStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
