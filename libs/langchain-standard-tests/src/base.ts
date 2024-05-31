import {
  BaseChatModel,
  BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import { BaseMessageChunk } from "@langchain/core/messages";

export type RecordStringAny = Record<string, any>;

export type BaseChatModelConstructor<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk
> = new (...args: any[]) => BaseChatModel<CallOptions, OutputMessageType>;

export type BaseChatModelsTestsFields<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk
> = {
  Cls: BaseChatModelConstructor<CallOptions, OutputMessageType>;
  chatModelHasToolCalling: boolean;
  chatModelHasStructuredOutput: boolean;
  constructorArgs: RecordStringAny;
};

export class BaseChatModelsTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk
> implements BaseChatModelsTestsFields<CallOptions, OutputMessageType>
{
  Cls: BaseChatModelConstructor<CallOptions, OutputMessageType>;

  chatModelHasToolCalling: boolean;

  chatModelHasStructuredOutput: boolean;

  constructorArgs: RecordStringAny;

  constructor(
    fields: BaseChatModelsTestsFields<CallOptions, OutputMessageType>
  ) {
    this.Cls = fields.Cls;
    this.chatModelHasToolCalling = fields.chatModelHasToolCalling;
    this.chatModelHasStructuredOutput = fields.chatModelHasStructuredOutput;
    this.constructorArgs = fields.constructorArgs;
  }
}
