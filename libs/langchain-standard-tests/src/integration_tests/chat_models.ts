import {
  BaseChatModel,
  BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import { BaseMessageChunk } from "@langchain/core/messages";

type BaseChatModelConstructor<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
> = new (...args: any[]) => BaseChatModel<CallOptions, OutputMessageType>;

export class ChatModelsIntegrationTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk
> {
  Cls: BaseChatModel<CallOptions, OutputMessageType>;

  constructor(Cls: BaseChatModelConstructor<CallOptions, OutputMessageType>) {
    this.Cls = new Cls();
  }
}
