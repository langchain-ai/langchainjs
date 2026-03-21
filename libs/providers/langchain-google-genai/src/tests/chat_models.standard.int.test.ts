import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIChatCallOptions,
} from "../chat_models.js";

class ChatGoogleGenerativeAIStandardIntegrationTests extends ChatModelIntegrationTests<
  GoogleGenerativeAIChatCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error(
        "Can not run Google Generative AI integration tests because GOOGLE_API_KEY is set"
      );
    }
    super({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Cls: ChatGoogleGenerativeAI as any,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      supportsParallelToolCalls: false,
      constructorArgs: {
        maxRetries: 1,
        model: "gemini-2.5-flash",
      },
      supportsStandardContentType: {
        text: true,
        audio: ["base64", "url", "dataUrl"],
        image: ["base64", "url", "dataUrl"],
        file: ["base64", "url", "dataUrl"],
      },
    });
  }

  async testStandardAudioContentBlocks() {
    this.skipTestMessage(
      "testStandardAudioContentBlocks",
      "ChatGoogleGenerativeAI",
      "Thinking model may return empty text for bare audio input without an accompanying text prompt."
    );
  }

  async testStandardImageContentBlocks() {
    this.skipTestMessage(
      "testStandardImageContentBlocks",
      "ChatGoogleGenerativeAI",
      "Gemini API cannot fetch the test image URL used by the standard test suite."
    );
  }

  async testInvokeMoreComplexTools() {
    this.skipTestMessage(
      "testInvokeMoreComplexTools",
      "ChatGoogleGenerativeAI",
      "ChatGoogleGenerativeAI does not support tool schemas which contain object with unknown/any parameters." +
        "ChatGoogleGenerativeAI only supports objects in schemas when the parameters are defined."
    );
  }
}

const testClass = new ChatGoogleGenerativeAIStandardIntegrationTests();
testClass.runTests("ChatGoogleGenerativeAIStandardIntegrationTests");
