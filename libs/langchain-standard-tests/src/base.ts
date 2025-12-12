import {
  BaseChatModel,
  BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import { AIMessageChunk } from "@langchain/core/messages";

export type RecordStringAny = Record<string, unknown>;

export type BaseChatModelConstructor<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends AIMessageChunk = AIMessageChunk,
  ConstructorArgs extends RecordStringAny = RecordStringAny
> = new (args: ConstructorArgs) => BaseChatModel<
  CallOptions,
  OutputMessageType
>;

export type BaseChatModelsTestsFields<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends AIMessageChunk = AIMessageChunk,
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
  supportsStandardContentType?: Partial<{
    text: boolean;
    image: ("url" | "dataUrl" | "base64" | "id")[];
    audio: ("url" | "dataUrl" | "base64" | "id")[];
    file: ("url" | "dataUrl" | "base64" | "id")[];
  }>;
};

export class BaseChatModelsTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends AIMessageChunk = AIMessageChunk,
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

  supportsStandardContentType?: Partial<{
    text: boolean;
    image: ("url" | "dataUrl" | "base64" | "id")[];
    audio: ("url" | "dataUrl" | "base64" | "id")[];
    file: ("url" | "dataUrl" | "base64" | "id")[];
  }>;

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
    this.supportsStandardContentType = fields.supportsStandardContentType;
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
