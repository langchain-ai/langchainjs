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
      supportsParallelToolCalls: true,
      constructorArgs: {
        model: "claude-sonnet-4-5-20250929",
      },
      supportsStandardContentType: {
        text: true,
        image: ["base64", "url", "dataUrl"],
        file: ["base64", "url", "dataUrl"],
      },
    });
  }

  async testParallelToolCalling() {
    // Override constructor args to use a better model for this test.
    // I found that haiku struggles with parallel tool calling.
    const constructorArgsCopy = { ...this.constructorArgs };
    this.constructorArgs = {
      ...this.constructorArgs,
      model: "claude-3-5-sonnet-20240620",
    };
    await super.testParallelToolCalling();
    this.constructorArgs = constructorArgsCopy;
  }
}

const testClass = new ChatAnthropicStandardIntegrationTests();

test("ChatAnthropicStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
