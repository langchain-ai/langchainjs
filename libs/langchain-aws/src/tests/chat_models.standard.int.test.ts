/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatBedrockConverse,
  ChatBedrockConverseCallOptions,
} from "../chat_models.js";

class ChatBedrockConverseStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatBedrockConverseCallOptions,
  AIMessageChunk
> {
  constructor() {
    const region = process.env.BEDROCK_AWS_REGION ?? "us-east-1";
    super({
      Cls: ChatBedrockConverse,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
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
}

const testClass = new ChatBedrockConverseStandardIntegrationTests();

test("ChatBedrockConverseStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
