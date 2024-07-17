/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { AzureChatOpenAI } from "../../azure/chat_models.js";
import { ChatOpenAICallOptions } from "../../chat_models.js";

beforeAll(() => {
  if (!process.env.AZURE_OPENAI_API_KEY) {
    process.env.AZURE_OPENAI_API_KEY = process.env.TEST_AZURE_OPENAI_API_KEY;
  }
  if (!process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME) {
    process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME =
      process.env.TEST_AZURE_OPENAI_API_DEPLOYMENT_NAME;
  }
  if (!process.env.AZURE_OPENAI_BASE_PATH) {
    process.env.AZURE_OPENAI_BASE_PATH =
      process.env.TEST_AZURE_OPENAI_BASE_PATH;
  }
  if (!process.env.AZURE_OPENAI_API_VERSION) {
    process.env.AZURE_OPENAI_API_VERSION =
      process.env.TEST_AZURE_OPENAI_API_VERSION;
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
