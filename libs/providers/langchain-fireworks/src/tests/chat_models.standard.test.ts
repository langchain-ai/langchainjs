import { AIMessageChunk } from "@langchain/core/messages";
import { ChatModelUnitTests } from "@langchain/standard-tests/vitest";

import { ChatFireworks, ChatFireworksCallOptions } from "../chat_models.js";

class ChatFireworksStandardUnitTests extends ChatModelUnitTests<
  ChatFireworksCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatFireworks,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
    process.env.FIREWORKS_API_KEY = "test";
  }

  testChatModelInitApiKey() {
    process.env.FIREWORKS_API_KEY = "";
    super.testChatModelInitApiKey();
    process.env.FIREWORKS_API_KEY = "test";
  }
}

const testClass = new ChatFireworksStandardUnitTests();
testClass.runTests("ChatFireworksStandardUnitTests");
