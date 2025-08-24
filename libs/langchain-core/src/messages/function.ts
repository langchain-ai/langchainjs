import {
  BaseMessage,
  BaseMessageChunk,
  type BaseMessageFields,
  mergeContent,
  _mergeDicts,
  type MessageType,
} from "./base.js";

/**
 * Represents a function message in a conversation.
 */
export class FunctionMessage extends BaseMessage {
  static lc_name() {
    return "FunctionMessage";
  }

  constructor(fields: BaseMessageFields);

  constructor(fields: string | BaseMessageFields) {
    super(typeof fields === "string" ? { content: fields } : fields);
  }

  _getType(): MessageType {
    return "function";
  }
}

/**
 * Represents a chunk of a function message, which can be concatenated
 * with other function message chunks.
 */
export class FunctionMessageChunk extends BaseMessageChunk {
  static lc_name() {
    return "FunctionMessageChunk";
  }

  _getType(): MessageType {
    return "function";
  }

  concat(chunk: FunctionMessageChunk) {
    return new FunctionMessageChunk({
      content: mergeContent(this.content, chunk.content),
      additional_kwargs: _mergeDicts(
        this.additional_kwargs,
        chunk.additional_kwargs
      ),
      response_metadata: _mergeDicts(
        this.response_metadata,
        chunk.response_metadata
      ),
      name: this.name ?? "",
      id: this.id ?? chunk.id,
    });
  }
}

export function isFunctionMessage(x: BaseMessage): x is FunctionMessage {
  return x._getType() === "function";
}

export function isFunctionMessageChunk(
  x: BaseMessageChunk
): x is FunctionMessageChunk {
  return x._getType() === "function";
}
