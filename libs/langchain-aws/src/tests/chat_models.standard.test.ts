/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatBedrockConverse,
  ChatBedrockConverseCallOptions,
} from "../chat_models.js";

class ChatBedrockConverseStandardUnitTests extends ChatModelUnitTests<
  ChatBedrockConverseCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatBedrockConverse,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
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

const testClass = new ChatBedrockConverseStandardUnitTests();

test("ChatBedrockConverseStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
