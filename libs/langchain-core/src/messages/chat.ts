import {
  BaseMessage,
  BaseMessageChunk,
  type BaseMessageFields,
  mergeContent,
  _mergeDicts,
} from "./base.js";
import {
  $MessageStructure,
  $StandardMessageStructure,
  MessageType,
} from "./message.js";
import { Constructor } from "./utils.js";

export interface ChatMessageFieldsWithRole extends BaseMessageFields {
  role: string;
}

/**
 * Represents a chat message in a conversation.
 */
export class ChatMessage<
    TStructure extends $MessageStructure = $StandardMessageStructure
  >
  extends BaseMessage<TStructure, "chat">
  implements ChatMessageFieldsWithRole
{
  static lc_name() {
    return "ChatMessage";
  }

  readonly type = "chat" as const;

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

  static isInstance(message: BaseMessage): message is ChatMessage {
    return message.type === "generic";
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
export class ChatMessageChunk<
    TStructure extends $MessageStructure = $StandardMessageStructure
  >
  extends BaseMessageChunk<TStructure, "chat">
  implements ChatMessageFieldsWithRole
{
  static lc_name() {
    return "ChatMessageChunk";
  }

  readonly type = "chat" as const;

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

  concat(chunk: ChatMessageChunk) {
    const Cls = this.constructor as Constructor<this>;
    return new Cls({
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

export function isChatMessage(x: BaseMessage): x is ChatMessage {
  return x.type === "generic";
}

export function isChatMessageChunk(x: BaseMessageChunk): x is ChatMessageChunk {
  return x.type === "generic";
}
