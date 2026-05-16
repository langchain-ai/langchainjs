import { ChatModelUnitTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";

import { ChatOpenRouter } from "../index.js";
import type { ChatOpenRouterCallOptions } from "../types.js";

class ChatOpenRouterStandardUnitTests extends ChatModelUnitTests<
  ChatOpenRouterCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatOpenRouter,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: { model: "openai/gpt-4o" },
    });
    process.env.OPENROUTER_API_KEY = "test";
  }

  testChatModelInitApiKey() {
    process.env.OPENROUTER_API_KEY = "";
    super.testChatModelInitApiKey();
    process.env.OPENROUTER_API_KEY = "test";
  }
}

const testClass = new ChatOpenRouterStandardUnitTests();
testClass.runTests("ChatOpenRouterStandardUnitTests");
