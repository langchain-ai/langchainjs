import { test, expect, jest } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatAlibabaTongyi,
  ChatAlibabaTongyiCallOptions,
} from "../alibaba_tongyi.js";

class ChatAlibabaTongyiStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatAlibabaTongyiCallOptions,
  AIMessageChunk
> {
  constructor(apiKey: string, region: "china" | "singapore" | "us") {
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

const hasApiKey = !!process.env.ALIBABA_API_KEY;
const runIfApiKey = hasApiKey ? test : test.skip;

runIfApiKey("ChatAlibabaTongyiStandardIntegrationTests", async () => {
  const apiKey = process.env.ALIBABA_API_KEY;
  const region =
    (process.env.ALIBABA_REGION as "china" | "singapore" | "us") ?? "singapore";
  if (!apiKey) {
    return;
  }
  const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const testClass = new ChatAlibabaTongyiStandardIntegrationTests(
      apiKey,
      region
    );
    const testResults = await testClass.runTests();
    expect(testResults).toBe(true);
  } finally {
    warnSpy.mockRestore();
  }
});
