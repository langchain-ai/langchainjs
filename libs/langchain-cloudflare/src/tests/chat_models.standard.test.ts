/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { LangSmithParams } from "@langchain/core/language_models/chat_models";
import {
  ChatCloudflareWorkersAI,
  ChatCloudflareWorkersAICallOptions,
} from "../chat_models.js";

class ChatCloudflareWorkersAIStandardUnitTests extends ChatModelUnitTests<
  ChatCloudflareWorkersAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatCloudflareWorkersAI,
      chatModelHasToolCalling: false,
      chatModelHasStructuredOutput: false,
      constructorArgs: {},
    });
  }

  testChatModelInitApiKey() {
    this.skipTestMessage(
      "testChatModelInitApiKey",
      "ChatCloudflareWorkersAI",
      this.multipleApiKeysRequiredMessage
    );
  }

  expectedLsParams(): Partial<LangSmithParams> {
    console.warn(
      "Overriding testStandardParams. ChatCloudflareWorkersAI does not support temperature or max tokens."
    );
    return {
      ls_provider: "string",
      ls_model_name: "string",
      ls_model_type: "chat",
      ls_stop: ["Array<string>"],
    };
  }
}

const testClass = new ChatCloudflareWorkersAIStandardUnitTests();

test("ChatCloudflareWorkersAIStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
