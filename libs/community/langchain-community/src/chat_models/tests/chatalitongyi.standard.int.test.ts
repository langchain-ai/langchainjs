import { vi, beforeAll, afterAll } from "vitest";
import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatAlibabaTongyi,
  ChatAlibabaTongyiCallOptions,
} from "../alibaba_tongyi.js";

const apiKey = process.env.ALIBABA_API_KEY ?? "test";
const region =
  (process.env.ALIBABA_REGION as "china" | "singapore" | "us") ?? "singapore";

class ChatAlibabaTongyiStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatAlibabaTongyiCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatAlibabaTongyi,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      supportsParallelToolCalls: true,
      constructorArgs: {
        alibabaApiKey: apiKey,
        region,
        model: "qwen-plus",
        temperature: 0,
      },
    });
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesListContent",
      "ChatAlibabaTongyi",
      "Only string message content is supported."
    );
  }

  async testCacheComplexMessageTypes() {
    this.skipTestMessage(
      "testCacheComplexMessageTypes",
      "ChatAlibabaTongyi",
      "Only string message content is supported."
    );
  }
}

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => {
  warnSpy.mockRestore();
});

const testClass = new ChatAlibabaTongyiStandardIntegrationTests();
testClass.runTests("ChatAlibabaTongyiStandardIntegrationTests");
