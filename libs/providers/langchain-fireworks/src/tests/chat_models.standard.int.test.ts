import { AIMessageChunk } from "@langchain/core/messages";
import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";

import { ChatFireworks, ChatFireworksCallOptions } from "../chat_models.js";

class ChatFireworksStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatFireworksCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.FIREWORKS_API_KEY) {
      throw new Error(
        "Can not run Fireworks integration tests because FIREWORKS_API_KEY is not set"
      );
    }
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
