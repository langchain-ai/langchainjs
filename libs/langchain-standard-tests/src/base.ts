import {
  BaseChatModel,
  BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import { BaseMessageChunk } from "@langchain/core/messages";

export type RecordStringAny = Record<string, any>;

export type BaseChatModelConstructor<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk,
  ConstructorArgs extends RecordStringAny = RecordStringAny
> = new (args: ConstructorArgs) => BaseChatModel<
  CallOptions,
  OutputMessageType
>;

export type BaseChatModelsTestsFields<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk,
  ConstructorArgs extends RecordStringAny = RecordStringAny
> = {
  Cls: BaseChatModelConstructor<
    CallOptions,
    OutputMessageType,
    ConstructorArgs
  >;
  chatModelHasToolCalling: boolean;
  chatModelHasStructuredOutput: boolean;
  constructorArgs: ConstructorArgs;
};

export class BaseChatModelsTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk,
  ConstructorArgs extends RecordStringAny = RecordStringAny
> implements
    BaseChatModelsTestsFields<CallOptions, OutputMessageType, ConstructorArgs>
{
  Cls: BaseChatModelConstructor<
    CallOptions,
    OutputMessageType,
    ConstructorArgs
  >;

  chatModelHasToolCalling: boolean;

  chatModelHasStructuredOutput: boolean;

  constructorArgs: ConstructorArgs;

  constructor(
    fields: BaseChatModelsTestsFields<
      CallOptions,
      OutputMessageType,
      ConstructorArgs
    >
  ) {
    this.Cls = fields.Cls;
    this.chatModelHasToolCalling = fields.chatModelHasToolCalling;
    this.chatModelHasStructuredOutput = fields.chatModelHasStructuredOutput;
    this.constructorArgs = fields.constructorArgs;
  }

  get multipleApiKeysRequiredMessage(): string {
    return "Multiple API keys are required.";
  }

  /**
   * Log a warning message when skipping a test.
   */
  skipTestMessage(
    testName: string,
    chatClassName: string,
    extra?: string
  ): void {
    console.warn(
      {
        chatClassName,
        reason: extra ?? "n/a",
      },
      `Skipping ${testName}.`
    );
  }
}
