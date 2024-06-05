/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatTogetherAI, ChatTogetherAICallOptions } from "../togetherai.js";

class ChatTogetherAIStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatTogetherAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatTogetherAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
  }
}

const testClass = new ChatTogetherAIStandardIntegrationTests();

test("ChatTogetherAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
