import { expect, describe, test } from "vitest";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { BaseMessageChunk } from "@langchain/core/messages";
import { RecordStringAny } from "../base.js";
import {
  ChatModelIntegrationTestsFields,
  ChatModelIntegrationTests as BaseChatModelIntegrationTests,
} from "./chat_models.js";

export abstract class ChatModelIntegrationTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk,
  ConstructorArgs extends RecordStringAny = RecordStringAny
> extends BaseChatModelIntegrationTests<
  CallOptions,
  OutputMessageType,
  ConstructorArgs
> {
  constructor(
    fields: ChatModelIntegrationTestsFields<
      CallOptions,
      OutputMessageType,
      ConstructorArgs
    >
  ) {
    super(fields);
    this.expect = expect;
  }

  /**
   * Run all unit tests for the chat model.
   * Each test is wrapped in a try/catch block to prevent the entire test suite from failing.
   * If a test fails, the error is logged to the console, and the test suite continues.
   */
  runTests(testName = "ChatModelIntegrationTests") {
    describe(testName, () => {
      test("testInvoke", () => this.testInvoke());
      test("testStream", () => this.testStream());
      test("testBatch", () => this.testBatch());
      test("testConversation", () => this.testConversation());
      test("testUsageMetadata", () => this.testUsageMetadata());
      test("testUsageMetadataStreaming", () =>
        this.testUsageMetadataStreaming());
      test("testToolMessageHistoriesStringContent", () =>
        this.testToolMessageHistoriesStringContent());
      test("testToolMessageHistoriesListContent", () =>
        this.testToolMessageHistoriesListContent());
      test("testStructuredFewShotExamples", () =>
        this.testStructuredFewShotExamples());
      test("testWithStructuredOutput", () => this.testWithStructuredOutput());
      test("testWithStructuredOutputIncludeRaw", () =>
        this.testWithStructuredOutputIncludeRaw());
      test("testBindToolsWithOpenAIFormattedTools", () =>
        this.testBindToolsWithOpenAIFormattedTools());
      test("testBindToolsWithRunnableToolLike", () =>
        this.testBindToolsWithRunnableToolLike());
      test("testCacheComplexMessageTypes", () =>
        this.testCacheComplexMessageTypes());
      test("testStreamTokensWithToolCalls", () =>
        this.testStreamTokensWithToolCalls());
      test("testModelCanUseToolUseAIMessage", () =>
        this.testModelCanUseToolUseAIMessage());
      test("testModelCanUseToolUseAIMessageWithStreaming", () =>
        this.testModelCanUseToolUseAIMessageWithStreaming());
      test("testInvokeMoreComplexTools", () =>
        this.testInvokeMoreComplexTools());
      test("testParallelToolCalling", () => this.testParallelToolCalling());
      test("testModelCanAcceptStructuredToolParamsSchema", () =>
        this.testModelCanAcceptStructuredToolParamsSchema());
      test("testStreamTools", () => this.testStreamTools());
      test("testStandardTextContentBlocks", () =>
        this.testStandardTextContentBlocks());
      test("testStandardImageContentBlocks", () =>
        this.testStandardImageContentBlocks());
      test("testStandardAudioContentBlocks", () =>
        this.testStandardAudioContentBlocks());
      test("testStandardFileContentBlocks", () =>
        this.testStandardFileContentBlocks());
    });
  }
}
