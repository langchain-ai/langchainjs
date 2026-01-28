import { ChatModelUnitTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatXAI, ChatXAICallOptions } from "../index.js";

class ChatXAIStandardUnitTests extends ChatModelUnitTests<
  ChatXAICallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatXAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
    // This must be set so method like `.bindTools` or `.withStructuredOutput`
    // which we call after instantiating the model will work.
    // (constructor will throw if API key is not set)
    process.env.XAI_API_KEY = "test";
  }

  testChatModelInitApiKey() {
    // Unset the API key env var here so this test can properly check
    // the API key class arg.
    process.env.XAI_API_KEY = "";
    super.testChatModelInitApiKey();
    // Re-set the API key env var here so other tests can run properly.
    process.env.XAI_API_KEY = "test";
  }
}

const testClass = new ChatXAIStandardUnitTests();
testClass.runTests("ChatXAIStandardUnitTests");
