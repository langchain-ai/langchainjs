import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatCohere,
  ChatCohereCallOptions,
  ChatCohereInput,
} from "../chat_models.js";

class ChatCohereStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatCohereCallOptions,
  AIMessageChunk,
  ChatCohereInput
> {
  constructor() {
    if (!process.env.COHERE_API_KEY) {
      throw new Error(
        "Can not run Cohere integration tests because COHERE_API_KEY is not set"
      );
    }
    super({
      Cls: ChatCohere,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "command-r-plus",
        maxRetries: 1,
        temperature: 0,
      },
    });
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesListContent",
      "ChatCohere",
      "Anthropic-style tool calling is not supported."
    );
  }

  async testStreamTokensWithToolCalls() {
    this.skipTestMessage(
      "testStreamTokensWithToolCalls",
      "ChatCohere",
      "Prompt does not always cause Cohere to invoke a tool. TODO: re-write inside this class with better prompting for cohere."
    );
  }

  async testModelCanUseToolUseAIMessageWithStreaming() {
    this.skipTestMessage(
      "testModelCanUseToolUseAIMessageWithStreaming",
      "ChatCohere",
      "Prompt does not always cause Cohere to invoke a tool. TODO: re-write inside this class with better prompting for cohere."
    );
  }

  async testStreamTools(): Promise<void> {
    this.skipTestMessage(
      "testStreamTools",
      "ChatCohere",
      "Cohere only responds with the tool call in the final chunk. TODO: fix implementation to actually stream tools."
    );
  }
}

const testClass = new ChatCohereStandardIntegrationTests();
testClass.runTests("ChatCohereStandardIntegrationTests");
