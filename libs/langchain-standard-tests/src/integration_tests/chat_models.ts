import {
  BaseChatModel,
  BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import { BaseMessageChunk } from "@langchain/core/messages";

type BaseChatModelConstructor<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk
> = new (...args: any[]) => BaseChatModel<CallOptions, OutputMessageType>;

export class ChatModelsIntegrationTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk
> {
  cls: BaseChatModel<CallOptions, OutputMessageType>;

  constructor(cls: BaseChatModelConstructor<CallOptions, OutputMessageType>) {
    this.cls = new cls();
  }
}
