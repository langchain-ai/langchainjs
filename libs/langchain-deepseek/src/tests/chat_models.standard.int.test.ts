/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatDeepseek, ChatDeepseekCallOptions } from "../chat_models.js";

class ChatDeepseekStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatDeepseekCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error(
        "DEEPSEEK_API_KEY must be set to run standard integration tests."
      );
    }
    super({
      Cls: ChatDeepseek,
      chatModelHasToolCalling: false,
      chatModelHasStructuredOutput: false,
      supportsParallelToolCalls: false,
      constructorArgs: {
        model: "deepseek-chat",
        maxRetries: 0,
      },
    });
  }

  supportedUsageMetadataDetails: {
    invoke: Array<
      | "audio_input"
      | "audio_output"
      | "reasoning_output"
      | "cache_read_input"
      | "cache_creation_input"
    >;
    stream: Array<
      | "audio_input"
      | "audio_output"
      | "reasoning_output"
      | "cache_read_input"
      | "cache_creation_input"
    >;
  } = { invoke: ["cache_read_input", "reasoning_output"], stream: [] };

  async invokeWithReasoningOutput(stream: boolean) {
    const chatModel = new ChatDeepseek({
      model: "deepseek-reasoner",
      streamUsage: true,
      temperature: 1,
    });
    const input =
      "explain the relationship between the 2008/9 economic crisis and the startup ecosystem in the early 2010s";

    return invoke(chatModel, input, stream);
  }

  // async testUsageMetadataStreaming() {
  //   // ChatDeepseek does not support streaming tokens by
  //   // default, so we must pass in a call option to
  //   // enable streaming tokens.
  //   const callOptions: ChatDeepseek["ParsedCallOptions"] = {
  //     stream_options: {
  //       include_usage: true,
  //     },
  //   };
  //   await super.testUsageMetadataStreaming(callOptions);
  // }

  async testInvokeMoreComplexTools() {
    this.skipTestMessage(
      "testInvokeMoreComplexTools",
      "ChatDeepseek",
      "Deepseek does not support tool schemas which contain object with unknown/any parameters." +
        "\nDeepseek only supports objects in schemas when the parameters are defined."
    );
  }

  async testParallelToolCalling() {
    const constructorArgsCopy = { ...this.constructorArgs };
    this.constructorArgs = {
      ...this.constructorArgs,
      model: "deepseek-chat",
    };
    await super.testParallelToolCalling();
    this.constructorArgs = constructorArgsCopy;
  }
}

const testClass = new ChatDeepseekStandardIntegrationTests();

test.skip("ChatDeepseekStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});

async function invoke(
  chatModel: ChatDeepseek,
  input: BaseLanguageModelInput,
  stream: boolean
): Promise<AIMessage> {
  if (stream) {
    let finalChunks: AIMessageChunk | undefined;

    // Stream the response for a simple "Hello" prompt
    for await (const chunk of await chatModel.stream(input)) {
      // Concatenate chunks to get the final result
      finalChunks = finalChunks ? concat(finalChunks, chunk) : chunk;
    }
    return finalChunks as AIMessage;
  } else {
    return chatModel.invoke(input);
  }
}
