/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatGoogle } from "../chat_models.js";
import { GoogleAIBaseLanguageModelCallOptions } from "@langchain/google-common";

class ChatGoogleStandardUnitTests extends ChatModelUnitTests<
  GoogleAIBaseLanguageModelCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatGoogle,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
    // This must be set so method like `.bindTools` or `.withStructuredOutput`
    // which we call after instantiating the model will work.
    // (constructor will throw if API key is not set)
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "test";
  }

  testChatModelInitApiKey() {
    this.skipTestMessage("testChatModelInitApiKey", "ChatGoogle (gauth)", this.multipleApiKeysRequiredMessage)
  }
}

const testClass = new ChatGoogleStandardUnitTests();

test("ChatGoogleStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
