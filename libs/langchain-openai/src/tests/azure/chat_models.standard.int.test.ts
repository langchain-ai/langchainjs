/* eslint-disable no-process-env */
import { test, expect, afterAll } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { AzureChatOpenAI } from "../../azure/chat_models.js";
import { ChatOpenAICallOptions } from "../../chat_models.js";

let openAIAPIKey: string | undefined;

afterAll(() => {
  if (openAIAPIKey) {
    process.env.OPENAI_API_KEY = openAIAPIKey;
  }
});

class AzureChatOpenAIStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatOpenAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: AzureChatOpenAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      supportsParallelToolCalls: true,
      constructorArgs: {
        model: "gpt-3.5-turbo",
        maxRetries: 0,
      },
    });
  }

  async testUsageMetadataStreaming() {
    this.skipTestMessage(
      "testUsageMetadataStreaming",
      "AzureChatOpenAI",
      "Streaming tokens is not currently supported."
    );
  }

  async testStreamTokensWithToolCalls() {
    this.skipTestMessage(
      "testStreamTokensWithToolCalls",
      "AzureChatOpenAI",
      "Streaming tokens is not currently supported."
    );
  }

  async testInvokeMoreComplexTools() {
    this.skipTestMessage(
      "testInvokeMoreComplexTools",
      "AzureChatOpenAI",
      "AzureChatOpenAI does not support tool schemas which contain object with unknown/any parameters." +
        "AzureChatOpenAI only supports objects in schemas when the parameters are defined."
    );
  }

  async testParallelToolCalling() {
    // Pass `true` in the second argument to only verify it can support parallel tool calls in the message history.
    // This is because the model struggles to actually call parallel tools.
    await super.testParallelToolCalling(undefined, true);
  }
}

const testClass = new AzureChatOpenAIStandardIntegrationTests();

test("AzureChatOpenAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
