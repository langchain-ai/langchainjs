/* eslint-disable no-process-env */
import { ChatModelUnitTests } from "@langchain/standard-tests/vitest";
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
testClass.runTests("AzureChatOpenAIStandardUnitTests");
