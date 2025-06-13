/* eslint-disable no-process-env */
import { test, expect, vi } from "vitest";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatOpenAI, ChatOpenAICallOptions } from "../chat_models.js";

/**
 * Mock the @jest/globals module to use the vitest test and expect functions.
 * This is necessary because the @langchain/standard-tests package uses the
 * @jest/globals module to run the tests.
 */
vi.mock('@jest/globals', () => ({ test, expect }));

class ChatOpenAIResponsesStandardUnitTests extends ChatModelUnitTests<
  ChatOpenAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatOpenAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: { useResponsesApi: true },
    });
    // This must be set so method like `.bindTools` or `.withStructuredOutput`
    // which we call after instantiating the model will work.
    // (constructor will throw if API key is not set)
    process.env.OPENAI_API_KEY = "test";
  }

  testChatModelInitApiKey() {
    // Unset the API key env var here so this test can properly check
    // the API key class arg.
    process.env.OPENAI_API_KEY = "";
    super.testChatModelInitApiKey();
    // Re-set the API key env var here so other tests can run properly.
    process.env.OPENAI_API_KEY = "test";
  }
}

const testClass = new ChatOpenAIResponsesStandardUnitTests();

test("ChatOpenAIResponsesStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
