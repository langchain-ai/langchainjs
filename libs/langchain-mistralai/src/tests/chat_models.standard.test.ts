/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { LangSmithParams } from "@langchain/core/language_models/chat_models";
import { ChatMistralAI, ChatMistralAICallOptions } from "../chat_models.js";

class ChatMistralAIStandardUnitTests extends ChatModelUnitTests<
  ChatMistralAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatMistralAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
    // This must be set so method like `.bindTools` or `.withStructuredOutput`
    // which we call after instantiating the model will work.
    // (constructor will throw if API key is not set)
    process.env.MISTRAL_API_KEY = "test";
  }

  expectedLsParams(): Partial<LangSmithParams> {
    console.warn(
      "Overriding testStandardParams. ChatCloudflareWorkersAI does not support stop sequences."
    );
    return {
      ls_provider: "string",
      ls_model_name: "string",
      ls_model_type: "chat",
      ls_temperature: 0,
      ls_max_tokens: 0,
    };
  }

  testChatModelInitApiKey() {
    // Unset the API key env var here so this test can properly check
    // the API key class arg.
    process.env.MISTRAL_API_KEY = "";
    super.testChatModelInitApiKey();
    // Re-set the API key env var here so other tests can run properly.
    process.env.MISTRAL_API_KEY = "test";
  }
}

const testClass = new ChatMistralAIStandardUnitTests();

test("ChatMistralAIStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
