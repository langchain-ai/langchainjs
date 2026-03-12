import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatFireworks, ChatFireworksCallOptions } from "../fireworks.js";

class ChatFireworksStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatFireworksCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatFireworks,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "accounts/fireworks/models/firefunction-v2",
      },
    });
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesListContent",
      "ChatFireworks",
      "Not implemented."
    );
  }
}

const testClass = new ChatFireworksStandardIntegrationTests();
testClass.runTests("ChatFireworksStandardIntegrationTests");
