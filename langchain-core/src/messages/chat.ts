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

  static isInstance(
    message: BaseMessage | null | undefined
  ): message is ChatMessage {
    if (message == null) return false;
    return message._getType() === "generic";
  }

  override get _printableFields(): Record<string, unknown> {
    return {
      ...super._printableFields,
      role: this.role,
    };
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

  override get _printableFields(): Record<string, unknown> {
    return {
      ...super._printableFields,
      role: this.role,
    };
  }
}

export function isChatMessage(
  x: BaseMessage | null | undefined
): x is ChatMessage {
  if (x == null) return false;
  return x._getType() === "generic";
}

export function isChatMessageChunk(
  x: BaseMessageChunk | null | undefined
): x is ChatMessageChunk {
  if (x == null) return false;
  return x._getType() === "generic";
}
