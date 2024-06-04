/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { AzureChatOpenAI } from "../../azure/chat_models.js";
import { ChatOpenAICallOptions } from "../../chat_models.js";

class AzureChatOpenAIStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatOpenAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: AzureChatOpenAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "gpt-3.5-turbo",
      },
    });
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesListContent",
      "AzureChatOpenAI",
      "Not properly implemented."
    );
  }

  async testUsageMetadataStreaming() {
    this.skipTestMessage(
      "testUsageMetadataStreaming",
      "AzureChatOpenAI",
      "Streaming tokens is not currently supported."
    );
  }
}

const testClass = new AzureChatOpenAIStandardIntegrationTests();

test("AzureChatOpenAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
