/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { readFileSync } from "fs";
import { join } from "path";
import { concat } from "@langchain/core/utils/stream";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatOpenAI, ChatOpenAICallOptions } from "../chat_models.js";

const REPO_ROOT_DIR = process.cwd();

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
        model: "gpt-5",
      },
      supportsStandardContentType: {
        text: true,
        // TODO: audio only supported by gpt-4o-audio-preview, but gpt-4o doesn't support the other input types
        // audio: ["base64", "url", "dataUrl"],
        image: ["base64", "url", "dataUrl"],
        file: ["base64", "url", "dataUrl"],
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
    const chatModel = new ChatOpenAI({
      model: "o1-mini",
      streamUsage: true,
      temperature: 1,
    });
    const input =
      "explain the relationship between the 2008/9 economic crisis and the startup ecosystem in the early 2010s";

    return invoke(chatModel, input, stream);
  }

  async invokeWithCacheReadInput(stream: boolean = false): Promise<AIMessage> {
    const readme = readFileSync(join(REPO_ROOT_DIR, "README.md"), "utf-8");

    const input = `What's langchain? Here's the langchain README:
    
    ${readme}
    `;
    const llm = new ChatOpenAI({ modelName: "gpt-4o-mini", streamUsage: true });
    await invoke(llm, input, stream);
    // invoke twice so first invocation is cached
    return invoke(llm, input, stream);
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
      model: "gpt-4o-mini",
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

async function invoke(
  chatModel: ChatOpenAI,
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
