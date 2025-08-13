/* eslint-disable no-process-env */
import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatMistralAI, ChatMistralAICallOptions } from "../chat_models.js";

class ChatMistralAIStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatMistralAICallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.MISTRAL_API_KEY) {
      throw new Error(
        "Can not run Mistral AI integration tests because MISTRAL_API_KEY is not set"
      );
    }
    super({
      Cls: ChatMistralAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
      // Mistral requires function call IDs to be a-z, A-Z, 0-9, with a length of 9.
      functionId: "123456789",
    });
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesListContent",
      "ChatMistralAI",
      "tool_use message blocks not supported"
    );
  }
}

const testClass = new ChatMistralAIStandardIntegrationTests();
testClass.runTests("ChatMistralAIStandardIntegrationTests");
