import {
  $MessageStructure,
  $StandardMessageStructure,
  AIMessage,
  Message,
} from "./message.js";

export interface MessageChunk extends Message {
  concat(chunk: MessageChunk): MessageChunk;
  toMessage(): Message;
}

export class AIMessageChunk<
    TStructure extends $MessageStructure = $StandardMessageStructure
  >
  extends AIMessage<TStructure>
  implements MessageChunk
{
  concat(other: AIMessageChunk): AIMessageChunk<TStructure> {
    // TODO: Implement this
    return new AIMessageChunk({
      ...this,
      content: [...this.content, ...other.content],
    });
  }

  toMessage(): AIMessage<TStructure> {
    return new AIMessage({
      id: this.id,
      name: this.name,
      content: this.content,
      responseMetadata: this.responseMetadata,
      usageMetadata: this.usageMetadata,
    });
  }
}
