/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIChatCallOptions,
} from "../chat_models.js";

class ChatGoogleGenerativeAIStandardIntegrationTests extends ChatModelIntegrationTests<
  GoogleGenerativeAIChatCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error(
        "Can not run Google Generative AI integration tests because GOOGLE_API_KEY is set"
      );
    }
    super({
      Cls: ChatGoogleGenerativeAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      supportsParallelToolCalls: true,
      constructorArgs: {
        maxRetries: 1,
        model: "gemini-1.5-pro",
      },
    });
  }

  async testInvokeMoreComplexTools() {
    this.skipTestMessage(
      "testInvokeMoreComplexTools",
      "ChatGoogleGenerativeAI",
      "ChatGoogleGenerativeAI does not support tool schemas which contain object with unknown/any parameters." +
        "ChatGoogleGenerativeAI only supports objects in schemas when the parameters are defined."
    );
  }
}

const testClass = new ChatGoogleGenerativeAIStandardIntegrationTests();

test("ChatGoogleGenerativeAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
