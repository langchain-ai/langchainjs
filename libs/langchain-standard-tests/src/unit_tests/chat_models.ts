import { expect } from "@jest/globals";
import {
  BaseChatModelCallOptions,
  LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import { BaseMessageChunk } from "@langchain/core/messages";
import { z } from "zod";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
import { StructuredTool } from "@langchain/core/tools";
import {
  BaseChatModelsTests,
  BaseChatModelsTestsFields,
  RecordStringAny,
} from "../base.js";

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
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk,
  ConstructorArgs extends RecordStringAny = RecordStringAny
> extends BaseChatModelsTests<CallOptions, OutputMessageType, ConstructorArgs> {
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
    expect(chatModel).toBeDefined();
  }

  testChatModelInitApiKey() {
    const params = { ...this.constructorArgs, apiKey: "test" };
    const chatModel = new this.Cls(params);
    expect(chatModel).toBeDefined();
  }

  testChatModelInitStreaming() {
    const params = { ...this.constructorArgs, streaming: true };
    const chatModel = new this.Cls(params);
    expect(chatModel).toBeDefined();
  }

  testChatModelWithBindTools() {
    if (!this.chatModelHasToolCalling) {
      return;
    }
    const chatModel = new this.Cls(this.constructorArgs);
    expect(chatModel.bindTools?.([new PersonTool()])).toBeDefined();
  }

  testChatModelWithStructuredOutput() {
    if (!this.chatModelHasStructuredOutput) {
      return;
    }
    const chatModel = new this.Cls(this.constructorArgs);
    expect((chatModel as any).withStructuredOutput?.(person)).toBeDefined();
  }

  testStandardParams() {
    const expectedParams = this.expectedLsParams();
    const chatModel = new this.Cls(this.constructorArgs);

    const lsParams = chatModel.getLsParams({} as any);
    expect(lsParams).toBeDefined();
    expect(Object.keys(lsParams).sort()).toEqual(
      Object.keys(expectedParams).sort()
    );
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
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testChatModelInit failed", e);
    }

    try {
      this.testChatModelInitApiKey();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testChatModelInitApiKey failed", e);
    }

    try {
      this.testChatModelInitStreaming();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testChatModelInitStreaming failed", e);
    }

    try {
      this.testChatModelWithBindTools();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testChatModelWithBindTools failed", e);
    }

    try {
      this.testChatModelWithStructuredOutput();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testChatModelWithStructuredOutput failed", e);
    }

    try {
      this.testStandardParams();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStandardParams failed", e);
    }

    return allTestsPassed;
  }
}
