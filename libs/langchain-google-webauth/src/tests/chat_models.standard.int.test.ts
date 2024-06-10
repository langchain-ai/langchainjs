/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatGoogle } from "../chat_models.js";
import { GoogleAIBaseLanguageModelCallOptions } from "@langchain/google-common";

class ChatGoogleStandardIntegrationTests extends ChatModelIntegrationTests<
  GoogleAIBaseLanguageModelCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.GOOGLE_VERTEX_AI_WEB_CREDENTIALS) {
      throw new Error(
        "GOOGLE_VERTEX_AI_WEB_CREDENTIALS must be set to run standard integration tests."
      );
    }
    super({
      Cls: ChatGoogle,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "gemini-1.5-pro",
      },
    });
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage("testToolMessageHistoriesListContent", "ChatGoogle (webauth)", "Not implemented.");
    expect(() => {
      super.testToolMessageHistoriesListContent();
    }).toThrow();
  }
}

const testClass = new ChatGoogleStandardIntegrationTests();

test("ChatGoogleStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
