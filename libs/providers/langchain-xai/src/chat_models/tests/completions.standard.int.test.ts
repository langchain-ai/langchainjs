import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatXAI, ChatXAICallOptions } from "../index.js";

class ChatXAIStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatXAICallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.XAI_API_KEY) {
      throw new Error(
        "Can not run xAI integration tests because XAI_API_KEY is not set"
      );
    }
    super({
      Cls: ChatXAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        maxRetries: 1,
        temperature: 0,
      },
    });
  }
}

const testClass = new ChatXAIStandardIntegrationTests();
testClass.runTests("ChatXAIStandardIntegrationTests");
