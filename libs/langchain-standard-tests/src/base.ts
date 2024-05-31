import {
  BaseChatModel,
  BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import { BaseMessageChunk } from "@langchain/core/messages";

export type BaseChatModelConstructor<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk
> = new (...args: any[]) => BaseChatModel<CallOptions, OutputMessageType>;

export type BaseChatModelsTestsFields<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk
> = {
  cls: BaseChatModelConstructor<CallOptions, OutputMessageType>;
};

export class BaseChatModelsTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk
> implements BaseChatModelsTestsFields<CallOptions, OutputMessageType>
{
  cls: BaseChatModelConstructor<CallOptions, OutputMessageType>;

  constructor(
    fields: BaseChatModelsTestsFields<CallOptions, OutputMessageType>
  ) {
    this.cls = fields.cls;
  }
}
