/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatCloudflareWorkersAI,
  ChatCloudflareWorkersAICallOptions,
} from "../chat_models.js";

class ChatCloudflareWorkersAIStandardUnitTests extends ChatModelUnitTests<
  ChatCloudflareWorkersAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatCloudflareWorkersAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
  }

  testChatModelInitApiKey() {
    console.warn(
      "Skipping testChatModelInitApiKey for ChatCloudflareWorkersAI. Multiple API keys are required."
    );
  }
}

const testClass = new ChatCloudflareWorkersAIStandardUnitTests();

test("ChatCloudflareWorkersAIStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
