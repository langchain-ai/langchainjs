/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatCloudflareWorkersAI,
  ChatCloudflareWorkersAICallOptions,
} from "../chat_models.js";

class ChatCloudflareWorkersAIStandardIntegrationTests extends ChatModelIntegrationTests<
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
}

const testClass = new ChatCloudflareWorkersAIStandardIntegrationTests();

test("ChatCloudflareWorkersAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
