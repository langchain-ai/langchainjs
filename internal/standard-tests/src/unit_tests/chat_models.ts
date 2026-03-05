import type { expect as JestExpect } from "@jest/globals";
import type { expect as VitestExpect } from "vitest";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import { AIMessageChunk, HumanMessage } from "@langchain/core/messages";
import { z } from "zod/v3";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { StructuredTool } from "@langchain/core/tools";
import {
  BaseChatModelsTests,
  BaseChatModelsTestsFields,
  RecordStringAny,
} from "../base.ts";

const person = /* #__PURE__ */ z
  .object({
    name: z.string().describe("Name of the person"),
    age: z.number().int().positive().describe("Age of the person"),
  })
  .describe("A person");

class PersonTool extends StructuredTool {
  name = "PersonTool";

  description = person.description ?? "description";

  schema = person;

  async _call(input: InferInteropZodOutput<typeof person>) {
    return JSON.stringify(input);
  }
}

export abstract class ChatModelUnitTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends AIMessageChunk = AIMessageChunk,
  ConstructorArgs extends RecordStringAny = RecordStringAny,
> extends BaseChatModelsTests<CallOptions, OutputMessageType, ConstructorArgs> {
  expect: typeof JestExpect | typeof VitestExpect;

  constructor(
    fields: BaseChatModelsTestsFields<
      CallOptions,
      OutputMessageType,
      ConstructorArgs
    >
  ) {
    const standardChatModelParams: RecordStringAny = {
      temperature: 0,
      maxTokens: 100,
      timeout: 60,
      stopSequences: [],
      maxRetries: 2,
    };
    super({
      ...fields,
      constructorArgs: {
        ...standardChatModelParams,
        ...fields.constructorArgs,
      },
    });
  }

  /**
   * Override this method if the chat model being tested does not
   * support all expected LangSmith parameters.
   * @returns {Partial<LangSmithParams>} The LangSmith parameters expected by the chat model.
   */
  expectedLsParams(): Partial<LangSmithParams> {
    return {
      ls_provider: "string",
      ls_model_name: "string",
      ls_model_type: "chat",
      ls_temperature: 0,
      ls_max_tokens: 0,
      ls_stop: ["Array<string>"],
    };
  }

  testChatModelInit() {
    const chatModel = new this.Cls(this.constructorArgs);
    this.expect(chatModel).toBeDefined();
  }

  testChatModelInitApiKey() {
    const params = { ...this.constructorArgs, apiKey: "test" };
    const chatModel = new this.Cls(params);
    this.expect(chatModel).toBeDefined();
  }

  testChatModelInitStreaming() {
    const params = { ...this.constructorArgs, streaming: true };
    const chatModel = new this.Cls(params);
    this.expect(chatModel).toBeDefined();
  }

  testChatModelWithBindTools() {
    if (!this.chatModelHasToolCalling) {
      return;
    }
    const chatModel = new this.Cls(this.constructorArgs);
    this.expect(chatModel.bindTools?.([new PersonTool()])).toBeDefined();
  }

  testChatModelWithStructuredOutput() {
    if (!this.chatModelHasStructuredOutput) {
      return;
    }
    const chatModel = new this.Cls(this.constructorArgs);
    this.expect(chatModel.withStructuredOutput?.(person)).toBeDefined();
  }

  testStandardParams() {
    const expectedParams = this.expectedLsParams();
    const chatModel = new this.Cls(this.constructorArgs);

    const lsParams = chatModel.getLsParams({} as CallOptions);
    this.expect(lsParams).toBeDefined();
    this.expect(Object.keys(lsParams).sort()).toEqual(
      Object.keys(expectedParams).sort()
    );
  }

  /**
   * Test that invoke throws when signal is already aborted.
   * This verifies the early abort check in _generate.
   */
  async testInvokeThrowsWithAbortedSignal() {
    // Use BaseChatModel type to avoid generic type parameter issues with object literals
    const chatModel: BaseChatModel = new this.Cls(this.constructorArgs);
    const abortedSignal = AbortSignal.abort();

    await this.expect(
      chatModel.invoke([new HumanMessage("hello")], { signal: abortedSignal })
    ).rejects.toThrow();
  }

  /**
   * Test that stream handles an already-aborted signal correctly.
   * The stream should either:
   * 1. Throw immediately (if it goes through _generate which has throwIfAborted)
   * 2. Complete with no chunks (if it goes directly to streaming and returns early)
   *
   * Either behavior is acceptable - the key is that we don't continue processing.
   */
  async testStreamReturnsEarlyWithAbortedSignal() {
    // Use BaseChatModel type to avoid generic type parameter issues with object literals
    const chatModel: BaseChatModel = new this.Cls(this.constructorArgs);
    const abortedSignal = AbortSignal.abort();

    const chunks: AIMessageChunk[] = [];
    try {
      const stream = await chatModel.stream([new HumanMessage("hello")], {
        signal: abortedSignal,
      });
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      // If we get here without throwing, we should have no chunks
      // (stream returned early due to aborted signal)
      this.expect(chunks.length).toBe(0);
    } catch {
      // Also acceptable - stream threw due to aborted signal
      // (e.g., if it went through _generate path which has throwIfAborted)
      this.expect(true).toBe(true);
    }
  }
}
