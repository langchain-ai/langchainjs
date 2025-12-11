/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "@jest/globals";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { BaseMessageChunk } from "@langchain/core/messages";
import { RecordStringAny } from "../base.ts";
import {
  ChatModelIntegrationTestsFields,
  ChatModelIntegrationTests as BaseChatModelIntegrationTests,
} from "./chat_models.ts";

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
   * @returns {boolean}
   */
  async runTests(): Promise<boolean> {
    let allTestsPassed = true;

    try {
      await this.testInvoke();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testInvoke failed", e.message);
    }

    try {
      await this.testStream();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStream failed", e.message);
    }

    try {
      await this.testBatch();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testBatch failed", e.message);
    }

    try {
      await this.testConversation();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testConversation failed", e.message);
    }

    try {
      await this.testUsageMetadata();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testUsageMetadata failed", e.message);
    }

    try {
      await this.testUsageMetadataStreaming();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testUsageMetadataStreaming failed", e.message);
    }

    try {
      await this.testToolMessageHistoriesStringContent();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testToolMessageHistoriesStringContent failed", e.message);
    }

    try {
      await this.testToolMessageHistoriesListContent();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testToolMessageHistoriesListContent failed", e.message);
    }

    try {
      await this.testStructuredFewShotExamples();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStructuredFewShotExamples failed", e.message);
    }

    try {
      await this.testWithStructuredOutput();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testWithStructuredOutput failed", e.message);
    }

    try {
      await this.testWithStructuredOutputIncludeRaw();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testWithStructuredOutputIncludeRaw failed", e.message);
    }

    try {
      await this.testBindToolsWithOpenAIFormattedTools();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testBindToolsWithOpenAIFormattedTools failed", e.message);
    }

    try {
      await this.testBindToolsWithRunnableToolLike();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testBindToolsWithRunnableToolLike failed", e.message);
    }

    try {
      await this.testCacheComplexMessageTypes();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testCacheComplexMessageTypes failed", e.message);
    }

    try {
      await this.testStreamTokensWithToolCalls();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStreamTokensWithToolCalls failed", e.message);
    }

    try {
      await this.testModelCanUseToolUseAIMessage();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testModelCanUseToolUseAIMessage failed", e.message);
    }

    try {
      await this.testModelCanUseToolUseAIMessageWithStreaming();
    } catch (e: any) {
      allTestsPassed = false;
      console.error(
        "testModelCanUseToolUseAIMessageWithStreaming failed",
        e.message
      );
    }

    try {
      await this.testInvokeMoreComplexTools();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testInvokeMoreComplexTools failed", e.message);
    }

    try {
      await this.testParallelToolCalling();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testParallelToolCalling failed", e.message);
    }

    try {
      await this.testModelCanAcceptStructuredToolParamsSchema();
    } catch (e: any) {
      allTestsPassed = false;
      console.error(
        "testModelCanAcceptStructuredToolParamsSchema failed",
        e.message
      );
    }

    try {
      await this.testStreamTools();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStreamTools failed", e.message);
    }

    try {
      await this.testStandardTextContentBlocks();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStandardTextContentBlocks failed", e.message);
    }

    try {
      await this.testStandardImageContentBlocks();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStandardImageContentBlocks failed", e.message);
    }

    try {
      await this.testStandardAudioContentBlocks();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStandardAudioContentBlocks failed", e.message);
    }

    try {
      await this.testStandardFileContentBlocks();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStandardFileContentBlocks failed", e.message);
    }

    return allTestsPassed;
  }
}
