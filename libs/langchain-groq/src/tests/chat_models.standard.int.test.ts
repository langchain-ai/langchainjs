/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatGroq, ChatGroqCallOptions } from "../chat_models.js";

class ChatGroqStandardIntegrationTests extends ChatModelIntegrationTests<
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
  }
}

const testClass = new ChatGroqStandardIntegrationTests();

test("ChatGroqStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
