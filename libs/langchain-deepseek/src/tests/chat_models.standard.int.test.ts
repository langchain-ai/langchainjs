/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
// import { readFileSync } from "fs";
// import { join } from "path";
// import { concat } from "@langchain/core/utils/stream";
// import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatDeepSeek, ChatDeepSeekCallOptions } from "../chat_models.js";

// const REPO_ROOT_DIR = process.cwd();

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
    invoke: Array<
      "audio_input" | "audio_output"
      // | "reasoning_output"
      // | "cache_read_input"
      // | "cache_creation_input"
    >;
    stream: Array<
      "audio_input" | "audio_output"
      // | "reasoning_output"
      // | "cache_read_input"
      // | "cache_creation_input"
    >;
  } = {
    invoke: [
      // "cache_read_input" "reasoning_output"
    ],
    stream: [],
  };

  // async invokeWithReasoningOutput(stream: boolean) {
  //   const chatModel = new ChatDeepSeek({
  //     model: "deepseek-reasoner",
  //     streamUsage: true,
  //     temperature: 1,
  //   });
  //   const input =
  //     "explain the relationship between the 2008/9 economic crisis and the startup ecosystem in the early 2010s";

  //   return invoke(chatModel, input, stream);
  // }

  // async testUsageMetadataStreaming() {
  //   // ChatDeepSeek does not support streaming tokens by
  //   // default, so we must pass in a call option to
  //   // enable streaming tokens.
  //   const callOptions: ChatDeepSeek["ParsedCallOptions"] = {
  //     stream_options: {
  //       include_usage: true,
  //     },
  //   };
  //   await super.testUsageMetadataStreaming(callOptions);
  // }

  // async invokeWithCacheReadInput(stream: boolean = false): Promise<AIMessage> {
  //   const readme = readFileSync(join(REPO_ROOT_DIR, "README.md"), "utf-8");

  //   const input = `What's langchain? Here's the langchain README:

  //   ${readme}
  //   `;
  //   const llm = new ChatDeepSeek({ model: "deepseek-chat", streamUsage: true });
  //   await invoke(llm, input, stream);
  //   // invoke twice so first invocation is cached
  //   return invoke(llm, input, stream);
  // }

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

test("ChatDeepSeekStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});

// async function invoke(
//   chatModel: ChatDeepSeek,
//   input: BaseLanguageModelInput,
//   stream: boolean
// ): Promise<AIMessage> {
//   if (stream) {
//     let finalChunks: AIMessageChunk | undefined;

//     // Stream the response for a simple "Hello" prompt
//     for await (const chunk of await chatModel.stream(input)) {
//       // Concatenate chunks to get the final result
//       finalChunks = finalChunks ? concat(finalChunks, chunk) : chunk;
//     }
//     return finalChunks as AIMessage;
//   } else {
//     return chatModel.invoke(input);
//   }
// }
