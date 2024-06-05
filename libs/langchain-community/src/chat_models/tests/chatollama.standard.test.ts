/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatOllama, ChatOllamaCallOptions } from "../ollama.js";

class ChatOllamaStandardUnitTests extends ChatModelUnitTests<
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

  testChatModelInitApiKey() {
    this.skipTestMessage(
      "testChatModelInitApiKey",
      "ChatOllama",
      "API key not required."
    );
  }
}

const testClass = new ChatOllamaStandardUnitTests();

test("ChatOllamaStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
