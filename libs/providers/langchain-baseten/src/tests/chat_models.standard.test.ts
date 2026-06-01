import { ChatModelUnitTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import type { ChatOpenAICallOptions } from "@langchain/openai";

import { ChatBaseten } from "../chat_models.js";

class ChatBasetenStandardUnitTests extends ChatModelUnitTests<
  ChatOpenAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatBaseten,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: { model: "deepseek-ai/DeepSeek-V3.1" },
    });
    process.env.BASETEN_API_KEY = "test";
  }

  testChatModelInitApiKey() {
    process.env.BASETEN_API_KEY = "";
    super.testChatModelInitApiKey();
    process.env.BASETEN_API_KEY = "test";
  }
}

const testClass = new ChatBasetenStandardUnitTests();
testClass.runTests("ChatBasetenStandardUnitTests");
