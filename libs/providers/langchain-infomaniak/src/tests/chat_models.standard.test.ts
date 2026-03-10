import { ChatModelUnitTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatInfomaniak, ChatInfomaniakCallOptions } from "../chat_models.js";

class ChatInfomaniakStandardUnitTests extends ChatModelUnitTests<
  ChatInfomaniakCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatInfomaniak,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {},
    });
    // Required so methods like `.bindTools` or `.withStructuredOutput`
    // which we call after instantiating the model will work.
    process.env.INFOMANIAK_API_KEY = "test";
    process.env.INFOMANIAK_PRODUCT_ID = "12345";
  }

  testChatModelInitApiKey() {
    process.env.INFOMANIAK_API_KEY = "";
    super.testChatModelInitApiKey();
    process.env.INFOMANIAK_API_KEY = "test";
  }
}

const testClass = new ChatInfomaniakStandardUnitTests();
testClass.runTests("ChatInfomaniakStandardUnitTests");
