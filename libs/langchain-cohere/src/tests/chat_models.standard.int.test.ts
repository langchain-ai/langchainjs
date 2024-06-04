/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatCohere, CohereChatCallOptions } from "../chat_models.js";

class ChatCohereStandardIntegrationTests extends ChatModelIntegrationTests<
  CohereChatCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatCohere,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
  }
}

const testClass = new ChatCohereStandardIntegrationTests();

test("ChatCohereStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
