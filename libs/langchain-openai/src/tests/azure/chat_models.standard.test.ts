/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { AzureChatOpenAI } from "../../azure/chat_models.js";
import { ChatOpenAICallOptions } from "../../chat_models.js";

class AzureChatOpenAIStandardUnitTests extends ChatModelUnitTests<
  ChatOpenAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: AzureChatOpenAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
    process.env.AZURE_OPENAI_API_KEY = "test";
    process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME = "test";
    process.env.AZURE_OPENAI_API_VERSION = "test";
    process.env.AZURE_OPENAI_BASE_PATH = "test";
  }

  testChatModelInitApiKey() {
    console.warn(
      "AzureChatOpenAI does not require a single API key. Skipping..."
    );
  }
}

const testClass = new AzureChatOpenAIStandardUnitTests();

test("AzureChatOpenAIStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
