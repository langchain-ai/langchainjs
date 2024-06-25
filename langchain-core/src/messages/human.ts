import {
  BaseMessage,
  BaseMessageChunk,
  mergeContent,
  _mergeDicts,
  type MessageType,
} from "./base.js";

/**
 * Represents a human message in a conversation.
 */
export class HumanMessage extends BaseMessage {
  static lc_name() {
    return "HumanMessage";
  }

  _getType(): MessageType {
    return "human";
  }

  toString(): string {
    const idString = this.id ? `id: ${this.id}\n` : "";
    const nameString = this.name ? `name: ${this.name}\n` : "";
    const contentString = `content: ${typeof this.content === "string" ? this.content : JSON.stringify(this.content)}`;
    return `HumanMessage: ${idString}${nameString}${contentString}`
  }
}

/**
 * Represents a chunk of a human message, which can be concatenated with
 * other human message chunks.
 */
export class HumanMessageChunk extends BaseMessageChunk {
  static lc_name() {
    return "HumanMessageChunk";
  }

  _getType(): MessageType {
    return "human";
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

  toString(): string {
    const idString = this.id ? `id: ${this.id}\n` : "";
    const nameString = this.name ? `name: ${this.name}\n` : "";
    const contentString = `content: ${typeof this.content === "string" ? this.content : JSON.stringify(this.content)}`;
    return `HumanMessageChunk: ${idString}${nameString}${contentString}`
  }
}
