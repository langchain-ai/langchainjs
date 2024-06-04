/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatGroq, ChatGroqCallOptions } from "../chat_models.js";

class ChatGroqStandardUnitTests extends ChatModelUnitTests<
  ChatGroqCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatGroq,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
    // This must be set so method like `.bindTools` or `.withStructuredOutput`
    // which we call after instantiating the model will work.
    // (constructor will throw if API key is not set)
    process.env.GROQ_API_KEY = "test";
  }

  testChatModelInitApiKey() {
    // Unset the API key env var here so this test can properly check
    // the API key class arg.
    process.env.GROQ_API_KEY = "";
    super.testChatModelInitApiKey();
    // Re-set the API key env var here so other tests can run properly.
    process.env.GROQ_API_KEY = "test";
  }
}

const testClass = new ChatGroqStandardUnitTests();

test("ChatGroqStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
