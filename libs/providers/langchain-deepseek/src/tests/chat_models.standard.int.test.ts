/* eslint-disable no-process-env */
import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatDeepSeek, ChatDeepSeekCallOptions } from "../chat_models.js";

class ChatDeepSeekStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatDeepSeekCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error(
        "DEEPSEEK_API_KEY must be set to run standard integration tests."
      );
    }
    super({
      Cls: ChatDeepSeek,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      supportsParallelToolCalls: false,
      constructorArgs: {
        model: "deepseek-chat",
        maxRetries: 0,
      },
    });
  }

  supportedUsageMetadataDetails: {
    invoke: Array<"audio_input" | "audio_output">;
    stream: Array<"audio_input" | "audio_output">;
  } = {
    invoke: [],
    stream: [],
  };

  async testInvokeMoreComplexTools() {
    this.skipTestMessage(
      "testInvokeMoreComplexTools",
      "ChatDeepSeek",
      "Deepseek does not support tool schemas which contain object with unknown/any parameters." +
        "\nDeepseek only supports objects in schemas when the parameters are defined."
    );
  }
}

const testClass = new ChatDeepSeekStandardIntegrationTests();
testClass.runTests("ChatDeepSeekStandardIntegrationTests");
