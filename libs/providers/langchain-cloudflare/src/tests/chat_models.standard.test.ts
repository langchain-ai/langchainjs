import { ChatModelUnitTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatCloudflareWorkersAI,
  ChatCloudflareWorkersAICallOptions,
} from "../chat_models.js";

class ChatCloudflareWorkersAIStandardUnitTests extends ChatModelUnitTests<
  ChatCloudflareWorkersAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatCloudflareWorkersAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
  }

  testChatModelInitApiKey() {
    this.skipTestMessage(
      "testChatModelInitApiKey",
      "ChatCloudflareWorkersAI",
      this.multipleApiKeysRequiredMessage
    );
  }
}

const testClass = new ChatCloudflareWorkersAIStandardUnitTests();
testClass.runTests("ChatCloudflareWorkersAIStandardUnitTests");
