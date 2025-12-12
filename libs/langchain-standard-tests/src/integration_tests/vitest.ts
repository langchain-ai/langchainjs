import { expect, describe, test } from "vitest";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk } from "@langchain/core/messages";
import { RecordStringAny } from "../base.js";
import {
  ChatModelIntegrationTestsFields,
  ChatModelIntegrationTests as BaseChatModelIntegrationTests,
} from "./chat_models.js";

export abstract class ChatModelIntegrationTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends AIMessageChunk = AIMessageChunk,
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
   * Run all integration tests for the chat model.
   */
  runTests(testName = "ChatModelIntegrationTests") {
    describe(testName, () => {
      test("should invoke model and return valid response", () =>
        this.testInvoke());
      test("should stream response tokens successfully", () =>
        this.testStream());
      test("should process multiple inputs in batch", () => this.testBatch());
      test("should handle multi-message conversation", () =>
        this.testConversation());
      test("should return usage metadata for invoke", () =>
        this.testUsageMetadata());
      test("should return usage metadata for streaming", () =>
        this.testUsageMetadataStreaming());
      test("should handle tool message histories with string content", () =>
        this.testToolMessageHistoriesStringContent());
      test("should handle tool message histories with list content", () =>
        this.testToolMessageHistoriesListContent());
      test("should handle structured few shot examples", () =>
        this.testStructuredFewShotExamples());
      test("should work with structured output", () =>
        this.testWithStructuredOutput());
      test("should work with structured output including raw", () =>
        this.testWithStructuredOutputIncludeRaw());
      test("should bind tools with OpenAI formatted tools", () =>
        this.testBindToolsWithOpenAIFormattedTools());
      test("should bind tools with runnable tool-like objects", () =>
        this.testBindToolsWithRunnableToolLike());
      test("should cache complex message types", () =>
        this.testCacheComplexMessageTypes());
      test("should stream tokens with tool calls", () =>
        this.testStreamTokensWithToolCalls());
      test("should use tool use AI message in conversation", () =>
        this.testModelCanUseToolUseAIMessage());
      test("should use tool use AI message with streaming", () =>
        this.testModelCanUseToolUseAIMessageWithStreaming());
      test("should invoke model with more complex tools", () =>
        this.testInvokeMoreComplexTools());
      test("should handle parallel tool calling", () =>
        this.testParallelToolCalling());
      test("should accept structured tool params schema", () =>
        this.testModelCanAcceptStructuredToolParamsSchema());
      test("should stream tools successfully", () => this.testStreamTools());
      test("should handle standard text content blocks", () =>
        this.testStandardTextContentBlocks());
      test("should handle standard image content blocks", () =>
        this.testStandardImageContentBlocks());
      test("should handle standard audio content blocks", () =>
        this.testStandardAudioContentBlocks());
      test("should handle standard file content blocks", () =>
        this.testStandardFileContentBlocks());
    });
  }
}
