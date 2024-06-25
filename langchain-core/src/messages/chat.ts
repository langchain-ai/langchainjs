import {
  BaseMessage,
  BaseMessageChunk,
  type BaseMessageFields,
  mergeContent,
  _mergeDicts,
  type MessageType,
} from "./base.js";

export interface ChatMessageFieldsWithRole extends BaseMessageFields {
  role: string;
}

/**
 * Represents a chat message in a conversation.
 */
export class ChatMessage
  extends BaseMessage
  implements ChatMessageFieldsWithRole
{
  static lc_name() {
    return "ChatMessage";
  }

  role: string;

  static _chatMessageClass(): typeof ChatMessage {
    return ChatMessage;
  }

  constructor(content: string, role: string);

  constructor(fields: ChatMessageFieldsWithRole);

  constructor(fields: string | ChatMessageFieldsWithRole, role?: string) {
    if (typeof fields === "string") {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { content: fields, role: role! };
    }
    super(fields);
    this.role = fields.role;
  }

  _getType(): MessageType {
    return "generic";
  }

  static isInstance(message: BaseMessage): message is ChatMessage {
    return message._getType() === "generic";
  }

  toString(): string {
    const idString = this.id ? `id: ${this.id}\n` : "";
    const roleString = `role: ${this.role}\n`;
    const nameString = this.name ? `name: ${this.name}\n` : "";
    const contentString = `content: ${typeof this.content === "string" ? this.content : JSON.stringify(this.content)}`;
    return `ChatMessage: ${idString}${roleString}${nameString}${contentString}`
  }
}

/**
 * Represents a chunk of a chat message, which can be concatenated with
 * other chat message chunks.
 */
export class ChatMessageChunk extends BaseMessageChunk {
  static lc_name() {
    return "ChatMessageChunk";
  }

  role: string;

  constructor(content: string, role: string);

  constructor(fields: ChatMessageFieldsWithRole);

  constructor(fields: string | ChatMessageFieldsWithRole, role?: string) {
    if (typeof fields === "string") {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { content: fields, role: role! };
    }
    super(fields);
    this.role = fields.role;
  }

  _getType(): MessageType {
    return "generic";
  }

  concat(chunk: ChatMessageChunk) {
    return new ChatMessageChunk({
      content: mergeContent(this.content, chunk.content),
      additional_kwargs: _mergeDicts(
        this.additional_kwargs,
        chunk.additional_kwargs
      ),
      response_metadata: _mergeDicts(
        this.response_metadata,
        chunk.response_metadata
      ),
      role: this.role,
      id: this.id ?? chunk.id,
    });
  }

  toString(): string {
    const idString = this.id ? `id: ${this.id}\n` : "";
    const roleString = `role: ${this.role}\n`;
    const nameString = this.name ? `name: ${this.name}\n` : "";
    const contentString = `content: ${typeof this.content === "string" ? this.content : JSON.stringify(this.content)}`;
    return `ChatMessageChunk: ${idString}${roleString}${nameString}${contentString}`
  }
}
