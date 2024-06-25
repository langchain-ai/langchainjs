/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatOpenAI, ChatOpenAICallOptions } from "../chat_models.js";

class ChatOpenAIStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatOpenAICallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY must be set to run standard integration tests."
      );
    }
    super({
      Cls: ChatOpenAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "gpt-3.5-turbo",
      },
    });
  }

  async testUsageMetadataStreaming() {
    // ChatOpenAI does not support streaming tokens by
    // default, so we must pass in a call option to
    // enable streaming tokens.
    const callOptions: ChatOpenAI["ParsedCallOptions"] = {
      stream_options: {
        include_usage: true,
      },
    };
    await super.testUsageMetadataStreaming(callOptions);
  }
}

const testClass = new ChatOpenAIStandardIntegrationTests();

test("ChatOpenAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
