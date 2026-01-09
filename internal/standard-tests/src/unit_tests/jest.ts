import { expect } from "@jest/globals";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { AIMessageChunk } from "@langchain/core/messages";
import { BaseChatModelsTestsFields, RecordStringAny } from "../base.ts";
import { ChatModelUnitTests as BaseChatModelUnitTests } from "./chat_models.ts";

export abstract class ChatModelUnitTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends AIMessageChunk = AIMessageChunk,
  ConstructorArgs extends RecordStringAny = RecordStringAny,
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
  runTests(): boolean {
    let allTestsPassed = true;
    try {
      this.testChatModelInit();
    } catch (e) {
      allTestsPassed = false;
      console.error("testChatModelInit failed", e);
    }

    try {
      this.testChatModelInitApiKey();
    } catch (e) {
      allTestsPassed = false;
      console.error("testChatModelInitApiKey failed", e);
    }

    try {
      this.testChatModelInitStreaming();
    } catch (e) {
      allTestsPassed = false;
      console.error("testChatModelInitStreaming failed", e);
    }

    try {
      this.testChatModelWithBindTools();
    } catch (e) {
      allTestsPassed = false;
      console.error("testChatModelWithBindTools failed", e);
    }

    try {
      this.testChatModelWithStructuredOutput();
    } catch (e) {
      allTestsPassed = false;
      console.error("testChatModelWithStructuredOutput failed", e);
    }

    try {
      this.testStandardParams();
    } catch (e) {
      allTestsPassed = false;
      console.error("testStandardParams failed", e);
    }

    return allTestsPassed;
  }
}
