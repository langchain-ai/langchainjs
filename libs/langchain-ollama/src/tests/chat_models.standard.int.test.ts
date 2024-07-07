/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatOllama, ChatOllamaCallOptions } from "../chat_models.js";

class ChatOllamaStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatOllamaCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatOllama,
      chatModelHasToolCalling: false,
      chatModelHasStructuredOutput: false,
      constructorArgs: {},
    });
  }
}

const testClass = new ChatOllamaStandardIntegrationTests();

test("ChatOllamaStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
