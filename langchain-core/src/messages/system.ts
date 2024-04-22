import {
  BaseMessage,
  BaseMessageChunk,
  mergeContent,
  _mergeDicts,
  type MessageType,
} from "./base.js";

/**
 * Represents a system message in a conversation.
 */
export class SystemMessage extends BaseMessage {
  static lc_name() {
    return "SystemMessage";
  }

  _getType(): MessageType {
    return "system";
  }
}

/**
 * Represents a chunk of a system message, which can be concatenated with
 * other system message chunks.
 */
export class SystemMessageChunk extends BaseMessageChunk {
  static lc_name() {
    return "SystemMessageChunk";
  }

  _getType(): MessageType {
    return "system";
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
    });
  }
}
