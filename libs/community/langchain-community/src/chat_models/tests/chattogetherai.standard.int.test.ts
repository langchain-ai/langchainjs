import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatTogetherAI, ChatTogetherAICallOptions } from "../togetherai.js";

class ChatTogetherAIStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatTogetherAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatTogetherAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
  }
}

const testClass = new ChatTogetherAIStandardIntegrationTests();
testClass.runTests("ChatTogetherAIStandardIntegrationTests");
