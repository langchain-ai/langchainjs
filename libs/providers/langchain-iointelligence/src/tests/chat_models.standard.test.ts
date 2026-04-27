import { ChatModelUnitTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatIOIntelligence,
  ChatIOIntelligenceCallOptions,
} from "../chat_models.js";

class ChatIOIntelligenceStandardUnitTests extends ChatModelUnitTests<
  ChatIOIntelligenceCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatIOIntelligence,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
    // This must be set so methods like `.bindTools` or `.withStructuredOutput`
    // which we call after instantiating the model will work.
    // (constructor will throw if API key is not set)
    process.env.IO_INTELLIGENCE_API_KEY = "test";
  }

  testChatModelInitApiKey() {
    // Unset the API key env var here so this test can properly check
    // the API key class arg.
    process.env.IO_INTELLIGENCE_API_KEY = "";
    super.testChatModelInitApiKey();
    // Re-set the API key env var here so other tests can run properly.
    process.env.IO_INTELLIGENCE_API_KEY = "test";
  }
}

const testClass = new ChatIOIntelligenceStandardUnitTests();
testClass.runTests("ChatIOIntelligenceStandardUnitTests");
