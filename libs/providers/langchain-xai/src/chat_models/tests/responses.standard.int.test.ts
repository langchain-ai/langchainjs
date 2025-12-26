import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatXAIResponses, ChatXAIResponsesCallOptions } from "../index.js";

class ChatXAIResponsesStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatXAIResponsesCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.XAI_API_KEY) {
      throw new Error(
        "Can not run xAI Responses integration tests because XAI_API_KEY is not set"
      );
    }
    super({
      Cls: ChatXAIResponses,
      chatModelHasToolCalling: false, // Tool calling not yet implemented
      chatModelHasStructuredOutput: false, // Structured output not yet implemented
      constructorArgs: {
        model: "grok-3-fast",
        maxRetries: 1,
        temperature: 0,
      },
    });
  }
}

const testClass = new ChatXAIResponsesStandardIntegrationTests();
testClass.runTests("ChatXAIResponsesStandardIntegrationTests");
