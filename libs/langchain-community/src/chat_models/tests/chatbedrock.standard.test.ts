/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { BedrockChat } from "../bedrock/index.js";

class BedrockChatStandardUnitTests extends ChatModelUnitTests<
  BaseChatModelCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: BedrockChat,
      chatModelHasToolCalling: false,
      chatModelHasStructuredOutput: false,
      constructorArgs: {},
    });
    process.env.BEDROCK_AWS_SECRET_ACCESS_KEY = "test";
    process.env.BEDROCK_AWS_ACCESS_KEY_ID = "test";
    process.env.BEDROCK_AWS_SESSION_TOKEN = "test";
    process.env.AWS_DEFAULT_REGION = "us-east-1";
  }

  testChatModelInitApiKey() {
    this.skipTestMessage(
      "testChatModelInitApiKey",
      "BedrockChat",
      this.multipleApiKeysRequiredMessage
    );
  }
}

const testClass = new BedrockChatStandardUnitTests();

test("BedrockChatStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
