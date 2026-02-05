import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatBedrockConverse,
  ChatBedrockConverseCallOptions,
} from "../chat_models.js";

class ChatBedrockConverseStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatBedrockConverseCallOptions,
  AIMessageChunk
> {
  constructor() {
    const region = process.env.BEDROCK_AWS_REGION ?? "us-east-1";
    super({
      Cls: ChatBedrockConverse,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      supportsParallelToolCalls: true,
      constructorArgs: {
        region,
        model: "anthropic.claude-3-sonnet-20240229-v1:0",
        credentials: {
          secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY,
          accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID,
        },
      },
      supportsStandardContentType: {
        text: true,
        image: ["base64", "dataUrl"],
        file: ["dataUrl", "url"],
      },
    });
  }

  async testToolMessageHistoriesStringContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesStringContent",
      "ChatBedrockConverse",
      "Not properly implemented."
    );
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesListContent",
      "ChatBedrockConverse",
      "Not properly implemented."
    );
  }

  async testStructuredFewShotExamples() {
    this.skipTestMessage(
      "testStructuredFewShotExamples",
      "ChatBedrockConverse",
      "Not properly implemented."
    );
  }

  async testParallelToolCalling() {
    // Pass `true` in the second argument to only verify it can support parallel tool calls in the message history.
    // This is because the model struggles to actually call parallel tools.
    await super.testParallelToolCalling(undefined, true);
  }
}

const testClass = new ChatBedrockConverseStandardIntegrationTests();
testClass.runTests("ChatBedrockConverseStandardIntegrationTests");
