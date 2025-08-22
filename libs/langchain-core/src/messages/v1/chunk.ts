import {
  $MessageStructure,
  $MessageType,
  $StandardMessageStructure,
  AIMessage,
  HumanMessage,
  isBrandedMessage,
  Message,
  SystemMessage,
  ToolMessage,
} from "./message.js";

function isBrandedChunk(chunk: unknown, role?: $MessageType) {
  return (
    isBrandedMessage(chunk, role) &&
    "concat" in chunk &&
    typeof chunk.concat === "function"
  );
}

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
      ...this,
    });
  }

  static isInstance(chunk: unknown): chunk is AIMessageChunk {
    return isBrandedChunk(chunk, "ai");
  }
}

export class HumanMessageChunk<
    TStructure extends $MessageStructure = $StandardMessageStructure
  >
  extends HumanMessage<TStructure>
  implements MessageChunk
{
  concat(other: HumanMessageChunk): HumanMessageChunk<TStructure> {
    return new HumanMessageChunk({
      ...this,
      content: [...this.content, ...other.content],
    });
  }

  toMessage(): HumanMessage<TStructure> {
    return new HumanMessage({
      ...this,
    });
  }

  static isInstance(chunk: unknown): chunk is HumanMessageChunk {
    return isBrandedChunk(chunk, "human");
  }
}

export class SystemMessageChunk<
    TStructure extends $MessageStructure = $StandardMessageStructure
  >
  extends SystemMessage<TStructure>
  implements MessageChunk
{
  concat(other: SystemMessageChunk): SystemMessageChunk<TStructure> {
    return new SystemMessageChunk({
      ...this,
      content: [...this.content, ...other.content],
    });
  }

  toMessage(): SystemMessage<TStructure> {
    return new SystemMessage({
      ...this,
    });
  }

  static isInstance(chunk: unknown): chunk is SystemMessageChunk {
    return isBrandedChunk(chunk, "system");
  }
}

export class ToolMessageChunk<
    TStructure extends $MessageStructure = $StandardMessageStructure
  >
  extends ToolMessage<TStructure>
  implements MessageChunk
{
  concat(other: ToolMessageChunk): ToolMessageChunk<TStructure> {
    return new ToolMessageChunk({
      ...this,
      content: [...this.content, ...other.content],
    });
  }

  toMessage(): ToolMessage<TStructure> {
    return new ToolMessage({
      ...this,
    });
  }
}
