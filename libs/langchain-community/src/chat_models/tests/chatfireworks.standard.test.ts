/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatFireworks, ChatFireworksCallOptions } from "../fireworks.js";

class ChatFireworksStandardUnitTests extends ChatModelUnitTests<
  ChatFireworksCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatFireworks,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
    process.env.FIREWORKS_API_KEY = "test";
  }

  testChatModelInitApiKey() {
    // Unset the API key env var here so this test can properly check
    // the API key class arg.
    process.env.FIREWORKS_API_KEY = "";
    super.testChatModelInitApiKey();
    // Re-set the API key env var here so other tests can run properly.
    process.env.FIREWORKS_API_KEY = "test";
  }
}

const testClass = new ChatFireworksStandardUnitTests();

test("ChatFireworksStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
