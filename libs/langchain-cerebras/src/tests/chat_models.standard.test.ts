/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatCerebras, ChatCerebrasCallOptions } from "../chat_models.js";

class ChatCerebrasStandardUnitTests extends ChatModelUnitTests<
  ChatCerebrasCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatCerebras as any,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "llama3.1-8b",
        maxRetries: 1,
        temperature: 0,
      },
    });
    // This must be set so method like `.bindTools` or `.withStructuredOutput`
    // which we call after instantiating the model will work.
    // (constructor will throw if API key is not set)
    process.env.CEREBRAS_API_KEY = "test";
  }

  testChatModelInitApiKey() {
    // Unset the API key env var here so this test can properly check
    // the API key class arg.
    process.env.CEREBRAS_API_KEY = "";
    super.testChatModelInitApiKey();
    // Re-set the API key env var here so other tests can run properly.
    process.env.CEREBRAS_API_KEY = "test";
  }
}

const testClass = new ChatCerebrasStandardUnitTests();

test("ChatCerebrasStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
