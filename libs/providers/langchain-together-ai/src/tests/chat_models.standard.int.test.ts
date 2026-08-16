import { AIMessageChunk } from "@langchain/core/messages";
import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import {
  ChatTogetherAI,
  type ChatTogetherAICallOptions,
} from "../chat_models.js";

class ChatTogetherAIStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatTogetherAICallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.TOGETHER_AI_API_KEY) {
      throw new Error(
        "Can not run Together AI integration tests because TOGETHER_AI_API_KEY is not set"
      );
    }
    super({
      Cls: ChatTogetherAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        maxRetries: 1,
      },
    });
  }
}

const testClass = new ChatTogetherAIStandardIntegrationTests();
testClass.runTests("ChatTogetherAIStandardIntegrationTests");
