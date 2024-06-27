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
      constructorArgs: {
        maxRetries: 1,
      },
    });
  }
}

const testClass = new ChatGoogleGenerativeAIStandardIntegrationTests();

test("ChatGoogleGenerativeAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
