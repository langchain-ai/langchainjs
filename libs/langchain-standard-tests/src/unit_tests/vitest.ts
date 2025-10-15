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
   */
  runTests(testName = "ChatModelUnitTests") {
    describe(testName, () => {
      test("should initialize chat model successfully", () =>
        this.testChatModelInit());
      test("should initialize chat model with API key", () =>
        this.testChatModelInitApiKey());
      test("should initialize chat model with streaming enabled", () =>
        this.testChatModelInitStreaming());
      test("should bind tools when tool calling is supported", () =>
        this.testChatModelWithBindTools());
      test("should work with structured output when supported", () =>
        this.testChatModelWithStructuredOutput());
      test("should return standard LangSmith parameters", () =>
        this.testStandardParams());
    });
  }
}
