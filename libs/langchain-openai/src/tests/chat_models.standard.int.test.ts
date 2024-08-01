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
      supportsParallelToolCalls: true,
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

  async testInvokeMoreComplexTools() {
    this.skipTestMessage(
      "testInvokeMoreComplexTools",
      "ChatOpenAI",
      "OpenAI does not support tool schemas which contain object with unknown/any parameters." +
        "\nOpenAI only supports objects in schemas when the parameters are defined."
    );
  }

  async testParallelToolCalling() {
    // Override constructor args to use a better model for this test.
    // I found that GPT 3.5 struggles with parallel tool calling.
    const constructorArgsCopy = { ...this.constructorArgs };
    this.constructorArgs = {
      ...this.constructorArgs,
      model: "gpt-4o",
    };
    await super.testParallelToolCalling();
    this.constructorArgs = constructorArgsCopy;
  }
}

const testClass = new ChatOpenAIStandardIntegrationTests();

test("ChatOpenAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
