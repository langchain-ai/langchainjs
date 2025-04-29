/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";

import { AIMessageChunk } from "@langchain/core/messages";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";

import { OciGenAiCohereChat } from "../cohere_chat.js";
import { OciGenAiGenericChat } from "../generic_chat.js";

type OciGenAiChatConstructor = new (args: any) =>
  | OciGenAiCohereChat
  | OciGenAiGenericChat;

class OciGenAiChatStandardIntegrationTests extends ChatModelIntegrationTests<
  BaseChatModelCallOptions,
  AIMessageChunk
> {
  constructor(
    classTypeToTest: OciGenAiChatConstructor,
    private classTypeName: string,
    onDemandModelId: string
  ) {
    super({
      Cls: classTypeToTest,
      chatModelHasToolCalling: false,
      chatModelHasStructuredOutput: false,
      supportsParallelToolCalls: false,
      constructorArgs: {
        compartmentId: process.env.OCI_GENAI_INTEGRATION_TESTS_COMPARTMENT_ID,
        onDemandModelId,
      },
    });
  }

  async testCacheComplexMessageTypes() {
    this._skipTestMessage("testCacheComplexMessageTypes");
  }

  async testStreamTokensWithToolCalls() {
    this._skipTestMessage("testStreamTokensWithToolCalls");
  }

  async testUsageMetadata() {
    this._skipTestMessage("testUsageMetadata");
  }

  async testUsageMetadataStreaming() {
    this._skipTestMessage("testUsageMetadataStreaming");
  }

  _skipTestMessage(testName: string) {
    this.skipTestMessage(testName, this.classTypeName, "Not implemented");
  }
}

const ociGenAiCohereChatTestClass = new OciGenAiChatStandardIntegrationTests(
  OciGenAiCohereChat,
  "OciGenAiCohereChat",
  process.env.OCI_GENAI_INTEGRATION_TESTS_COHERE_ON_DEMAND_MODEL_ID!
);

test("ociGenAiCohereChatTestClass", async () => {
  const testResults = await ociGenAiCohereChatTestClass.runTests();
  expect(testResults).toBe(true);
});

const ociGenAiGenericChatTestClass = new OciGenAiChatStandardIntegrationTests(
  OciGenAiGenericChat,
  "OciGenAiGenericChat",
  process.env.OCI_GENAI_INTEGRATION_TESTS_GENERIC_ON_DEMAND_MODEL_ID!
);

test("ociGenAiGenericChatTestClass", async () => {
  const testResults = await ociGenAiGenericChatTestClass.runTests();
  expect(testResults).toBe(true);
});