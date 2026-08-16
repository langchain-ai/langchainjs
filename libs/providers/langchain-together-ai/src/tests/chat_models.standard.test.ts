import { AIMessageChunk } from "@langchain/core/messages";
import { ChatModelUnitTests } from "@langchain/standard-tests/vitest";
import {
  ChatTogetherAI,
  type ChatTogetherAICallOptions,
} from "../chat_models.js";

class ChatTogetherAIStandardUnitTests extends ChatModelUnitTests<
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
    process.env.TOGETHER_AI_API_KEY = "test";
  }

  testChatModelInitApiKey() {
    process.env.TOGETHER_AI_API_KEY = "";
    super.testChatModelInitApiKey();
    process.env.TOGETHER_AI_API_KEY = "test";
  }
}

const testClass = new ChatTogetherAIStandardUnitTests();
testClass.runTests("ChatTogetherAIStandardUnitTests");
