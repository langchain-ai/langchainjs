import {
  BaseMessage,
  BaseMessageChunk,
  mergeContent,
  _mergeDicts,
  type MessageType,
  type BaseMessageFields,
  type MessageContent,
} from "./base.js";

export type SystemMessageFields = BaseMessageFields;

/**
 * Represents a system message in a conversation.
 */
export class SystemMessage extends BaseMessage {
  declare content: MessageContent;

  static lc_name() {
    return "SystemMessage";
  }

  _getType(): MessageType {
    return "system";
  }

  constructor(
    fields: string | SystemMessageFields,
    /** @deprecated */
    kwargs?: Record<string, unknown>
  ) {
    super(fields, kwargs);
  }
}

/**
 * Represents a chunk of a system message, which can be concatenated with
 * other system message chunks.
 */
export class SystemMessageChunk extends BaseMessageChunk {
  declare content: MessageContent;

  static lc_name() {
    return "SystemMessageChunk";
  }

  _getType(): MessageType {
    return "system";
  }

  constructor(
    fields: string | SystemMessageFields,
    /** @deprecated */
    kwargs?: Record<string, unknown>
  ) {
    super(fields, kwargs);
  }

  concat(chunk: SystemMessageChunk) {
    return new SystemMessageChunk({
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

export function isSystemMessage(x: BaseMessage): x is SystemMessage {
  return x._getType() === "system";
}

export function isSystemMessageChunk(
  x: BaseMessageChunk
): x is SystemMessageChunk {
  return x._getType() === "system";
}
