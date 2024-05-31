import { expect } from "@jest/globals";
import {
  BaseChatModelCallOptions,
  LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import { BaseMessage, BaseMessageChunk } from "@langchain/core/messages";
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import { ChatResult } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseChatModelsTests, BaseChatModelsTestsFields } from "../base.js";

const person = z
  .object({
    name: z.string().describe("Name of the person"),
    age: z.number().int().positive().describe("Age of the person"),
  })
  .describe("A person");

class PersonTool extends StructuredTool {
  name = "PersonTool";

  description = person.description ?? "description";

  schema = person;

  async _call(input: z.infer<typeof person>) {
    return JSON.stringify(input);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RecordStringAny = Record<string, any>;

export abstract class ChatModelUnitTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk
> extends BaseChatModelsTests<CallOptions, OutputMessageType> {
  constructor(
    fields: BaseChatModelsTestsFields<CallOptions, OutputMessageType>
  ) {
    super(fields);
  }

  abstract get constructorArgs(): RecordStringAny;

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((chatModel as any).withStructuredOutput?.(person)).toBeDefined();
  }

  testStandardParams() {
    const expectedParams: LangSmithParams = {
      ls_provider: "string",
      ls_model_name: "string",
      ls_model_type: "chat",
      ls_temperature: 0,
      ls_max_tokens: 0,
      ls_stop: ["Array<string>"],
    };
    class ModelExtendsChatModel extends this.Cls {
      constructor(fields: RecordStringAny) {
        super(fields);
      }

      _llmType(): string {
        throw new Error("Method not implemented.");
      }

      _generate(
        _messages: BaseMessage[],
        _options: this["ParsedCallOptions"],
        _runManager?: CallbackManagerForLLMRun | undefined
      ): Promise<ChatResult> {
        throw new Error("Method not implemented.");
      }

      checkLsParams(options: this["ParsedCallOptions"]) {
        const lsParams = this.getLsParams(options);
        return lsParams;
      }
    }
    const extendedModel = new ModelExtendsChatModel(this.constructorArgs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lsParams = extendedModel.checkLsParams({} as any);
    expect(lsParams).toBeDefined();
    expect(Object.keys(lsParams).sort()).toEqual(
      Object.keys(expectedParams).sort()
    );
  }

  /**
   * Run all unit tests for the chat model.
   * Each test is wrapped in a try/catch block to prevent the entire test suite from failing.
   * If a test fails, the error is logged to the console, and the test suite continues.
   * @returns {void}
   */
  runTests() {
    try {
      this.testChatModelInit();
    } catch (e) {
      console.error("'testChatModelInit' FAILED\n");
      console.error(e);
      console.error("\n");
    }

    try {
      this.testChatModelInitApiKey();
    } catch (e) {
      console.error("'testChatModelInitApiKey' FAILED\n");
      console.error(e);
      console.error("\n");
    }

    try {
      this.testChatModelInitStreaming();
    } catch (e) {
      console.error("'testChatModelInitStreaming' FAILED\n");
      console.error(e);
      console.error("\n");
    }

    try {
      this.testChatModelWithBindTools();
    } catch (e) {
      console.error("'testChatModelWithBindTools' FAILED\n");
      console.error(e);
      console.error("\n");
    }

    try {
      this.testChatModelWithStructuredOutput();
    } catch (e) {
      console.error("'testChatModelWithStructuredOutput' FAILED\n");
      console.error(e);
      console.error("\n");
    }

    try {
      this.testStandardParams();
    } catch (e) {
      console.error("'testStandardParams' FAILED\n");
      console.error(e);
      console.error("\n");
    }
  }
}
