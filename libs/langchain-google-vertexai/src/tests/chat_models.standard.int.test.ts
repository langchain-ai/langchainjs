/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { GoogleAIBaseLanguageModelCallOptions } from "@langchain/google-common";
import { ChatVertexAI } from "../chat_models.js";

class ChatVertexAIStandardIntegrationTests extends ChatModelIntegrationTests<
  GoogleAIBaseLanguageModelCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error(
        "GOOGLE_APPLICATION_CREDENTIALS must be set to run standard integration tests."
      );
    }
    super({
      Cls: ChatVertexAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      supportsParallelToolCalls: true,
      invokeResponseType: AIMessageChunk,
      constructorArgs: {
        model: "gemini-2.0-flash",
      },
      supportsStandardContentType: {
        text: true,
        audio: ["base64", "url", "dataUrl"],
        image: ["base64", "url", "dataUrl"],
        file: ["base64", "url", "dataUrl"],
      },
    });
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesListContent",
      "ChatVertexAI",
      "Not implemented."
    );
  }

  async testInvokeMoreComplexTools() {
    this.skipTestMessage(
      "testInvokeMoreComplexTools",
      "ChatVertexAI",
      "Google VertexAI does not support tool schemas which contain object with unknown/any parameters." +
        "Google VertexAI only supports objects in schemas when the parameters are defined."
    );
  }

  async testParallelToolCalling() {
    // Pass `true` in the second argument to only verify it can support parallel tool calls in the message history.
    // This is because the model struggles to actually call parallel tools.
    await super.testParallelToolCalling(undefined, true);
  }
}

const testClass = new ChatVertexAIStandardIntegrationTests();

test("ChatVertexAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
