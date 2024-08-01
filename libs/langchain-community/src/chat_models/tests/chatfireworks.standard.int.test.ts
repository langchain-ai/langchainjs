/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatFireworks, ChatFireworksCallOptions } from "../fireworks.js";

class ChatFireworksStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatFireworksCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatFireworks,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "accounts/fireworks/models/firefunction-v1",
      },
    });
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesListContent",
      "ChatFireworks",
      "Not implemented."
    );
  }
}

const testClass = new ChatFireworksStandardIntegrationTests();

test("ChatFireworksStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
