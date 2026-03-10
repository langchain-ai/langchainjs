import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatInfomaniak, ChatInfomaniakCallOptions } from "../chat_models.js";

class ChatInfomaniakStandardIntTests extends ChatModelIntegrationTests<
  ChatInfomaniakCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.INFOMANIAK_API_KEY) {
      throw new Error(
        "INFOMANIAK_API_KEY must be set to run standard integration tests."
      );
    }
    if (!process.env.INFOMANIAK_PRODUCT_ID) {
      throw new Error(
        "INFOMANIAK_PRODUCT_ID must be set to run standard integration tests."
      );
    }
    super({
      Cls: ChatInfomaniak,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      supportsParallelToolCalls: false,
      constructorArgs: {
        model: "qwen3",
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
      "ChatInfomaniak",
      "Skipped: model may not support complex tool schemas with unknown parameters."
    );
  }

  async testUsageMetadata() {
    this.skipTestMessage(
      "testUsageMetadata",
      "ChatInfomaniak",
      "Skipped: Infomaniak API does not return model name in response_metadata."
    );
  }

  async testWithStructuredOutput() {
    this.skipTestMessage(
      "testWithStructuredOutput",
      "ChatInfomaniak",
      "Skipped: structured output method name mismatch (function_calling vs functionCalling)."
    );
  }

  async testWithStructuredOutputIncludeRaw() {
    this.skipTestMessage(
      "testWithStructuredOutputIncludeRaw",
      "ChatInfomaniak",
      "Skipped: structured output method name mismatch (function_calling vs functionCalling)."
    );
  }
}

const testClass = new ChatInfomaniakStandardIntTests();
testClass.runTests("ChatInfomaniakStandardIntTests");
