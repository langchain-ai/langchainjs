import {
  BaseMessage,
  BaseMessageChunk,
  mergeContent,
  _mergeDicts,
  type MessageType,
} from "./base.js";

/**
 * Represents a developer message in a conversation.
 *
 * Currently, all models other than OpenAI's o1 should treat this the same
 * as a system message.
 */
export class DeveloperMessage extends BaseMessage {
  static lc_name() {
    return "DeveloperMessage";
  }

  _getType(): MessageType {
    return "developer";
  }
}

/**
 * Represents a chunk of a developer message, which can be concatenated with
 * other developer message chunks.
 */
export class DeveloperMessageChunk extends BaseMessageChunk {
  static lc_name() {
    return "DeveloperMessageChunk";
  }

  _getType(): MessageType {
    return "developer";
  }

  concat(chunk: DeveloperMessageChunk) {
    return new DeveloperMessageChunk({
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

export function isDeveloperMessage(x: BaseMessage): x is DeveloperMessage {
  return x._getType() === "developer";
}

export function isDeveloperMessageChunk(
  x: BaseMessageChunk
): x is DeveloperMessageChunk {
  return x._getType() === "developer";
}
