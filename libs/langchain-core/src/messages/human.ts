import {
  BaseMessage,
  BaseMessageChunk,
  mergeContent,
  _mergeDicts,
  type MessageType,
  type BaseMessageFields,
  type MessageContent,
} from "./base.js";

export type HumanMessageFields = BaseMessageFields;

/**
 * Represents a human message in a conversation.
 */
export class HumanMessage extends BaseMessage {
  declare content: MessageContent;

  static lc_name() {
    return "HumanMessage";
  }

  _getType(): MessageType {
    return "human";
  }

  constructor(
    fields: string | HumanMessageFields,
    /** @deprecated */
    kwargs?: Record<string, unknown>
  ) {
    super(fields, kwargs);
  }
}

/**
 * Represents a chunk of a human message, which can be concatenated with
 * other human message chunks.
 */
export class HumanMessageChunk extends BaseMessageChunk {
  declare content: MessageContent;

  static lc_name() {
    return "HumanMessageChunk";
  }

  _getType(): MessageType {
    return "human";
  }

  constructor(
    fields: string | HumanMessageFields,
    /** @deprecated */
    kwargs?: Record<string, unknown>
  ) {
    super(fields, kwargs);
  }

  concat(chunk: HumanMessageChunk) {
    return new HumanMessageChunk({
      content: mergeContent(this.content, chunk.content),
      additional_kwargs: _mergeDicts(
        this.additional_kwargs,
        chunk.additional_kwargs
      ),
      response_metadata: _mergeDicts(
        this.response_metadata,
        chunk.response_metadata
      ),
      id: this.id ?? chunk.id,
    });
  }
}

export function isHumanMessage(x: BaseMessage): x is HumanMessage {
  return x.getType() === "human";
}

export function isHumanMessageChunk(
  x: BaseMessageChunk
): x is HumanMessageChunk {
  return x.getType() === "human";
}
