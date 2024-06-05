/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatTogetherAI, ChatTogetherAICallOptions } from "../togetherai.js";

class ChatTogetherAIStandardUnitTests extends ChatModelUnitTests<
  ChatTogetherAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatTogetherAI,
      chatModelHasToolCalling: false,
      chatModelHasStructuredOutput: false,
      constructorArgs: {},
    });
    process.env.TOGETHER_AI_API_KEY = "test";
  }

  testChatModelInitApiKey() {
    // Unset the API key env var here so this test can properly check
    // the API key class arg.
    process.env.TOGETHER_AI_API_KEY = "";
    super.testChatModelInitApiKey();
    // Re-set the API key env var here so other tests can run properly.
    process.env.TOGETHER_AI_API_KEY = "test";
  }
}

const testClass = new ChatTogetherAIStandardUnitTests();

test("ChatTogetherAIStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
