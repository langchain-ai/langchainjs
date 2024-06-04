/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatMistralAI, MistralAICallOptions } from "../chat_models.js";

class ChatMistralAIStandardIntegrationTests extends ChatModelIntegrationTests<
  MistralAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatMistralAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
  }
}

const testClass = new ChatMistralAIStandardIntegrationTests();

test("ChatMistralAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
