import { expect, describe, test } from "vitest";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { BaseMessageChunk } from "@langchain/core/messages";
import { BaseChatModelsTestsFields, RecordStringAny } from "../base.js";
import { ChatModelUnitTests as BaseChatModelUnitTests } from "./chat_models.js";

export abstract class ChatModelUnitTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk,
  ConstructorArgs extends RecordStringAny = RecordStringAny
> extends BaseChatModelUnitTests<
  CallOptions,
  OutputMessageType,
  ConstructorArgs
> {
  constructor(
    fields: BaseChatModelsTestsFields<
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
  runTests(testName = "ChatModelUnitTests") {
    describe(testName, () => {
      test("testChatModelInit", () => this.testChatModelInit());
      test("testChatModelInitApiKey", () => this.testChatModelInitApiKey());
      test("testChatModelInitStreaming", () =>
        this.testChatModelInitStreaming());
      test("testChatModelWithBindTools", () =>
        this.testChatModelWithBindTools());
      test("testChatModelWithStructuredOutput", () =>
        this.testChatModelWithStructuredOutput());
      test("testStandardParams", () => this.testStandardParams());
    });
  }
}
