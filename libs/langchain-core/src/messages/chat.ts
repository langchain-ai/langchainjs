import {
  BaseMessage,
  BaseMessageChunk,
  type BaseMessageFields,
  mergeContent,
  _mergeDicts,
} from "./base.js";
import { $InferMessageContent, $MessageStructure } from "./message.js";
import { Constructor } from "./utils.js";

export interface ChatMessageFields<
  TStructure extends $MessageStructure = $MessageStructure
> extends BaseMessageFields<TStructure, "generic"> {
  role: string;
}

/**
 * Represents a chat message in a conversation.
 */
export class ChatMessage<
    TStructure extends $MessageStructure = $MessageStructure
  >
  extends BaseMessage<TStructure, "generic">
  implements ChatMessageFields<TStructure>
{
  static lc_name() {
    return "ChatMessage";
  }

  readonly type = "generic" as const;

  role: string;

  static _chatMessageClass(): typeof ChatMessage {
    return ChatMessage;
  }

  constructor(
    fields:
      | $InferMessageContent<TStructure, "generic">
      | ChatMessageFields<TStructure>,
    role?: string
  ) {
    if (typeof fields === "string" || Array.isArray(fields)) {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { content: fields, role: role! };
    }
    super(fields);
    this.role = fields.role;
  }

  static isInstance(obj: unknown): obj is ChatMessage {
    return super.isInstance(obj) && obj.type === "generic";
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
  TStructure extends $MessageStructure = $MessageStructure
> extends BaseMessageChunk<TStructure, "generic"> {
  static lc_name() {
    return "ChatMessageChunk";
  }

  readonly type = "generic" as const;

  role: string;

  constructor(
    fields:
      | $InferMessageContent<TStructure, "generic">
      | ChatMessageFields<TStructure>,
    role?: string
  ) {
    if (typeof fields === "string" || Array.isArray(fields)) {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { content: fields, role: role! };
    }
    super(fields);
    this.role = fields.role;
  }

  concat(chunk: ChatMessageChunk<TStructure>) {
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

  static isInstance(obj: unknown): obj is ChatMessageChunk {
    return super.isInstance(obj) && obj.type === "generic";
  }

  override get _printableFields(): Record<string, unknown> {
    return {
      ...super._printableFields,
      role: this.role,
    };
  }
}

/**
 * @deprecated Use {@link ChatMessage.isInstance} instead
 */
export function isChatMessage(x: BaseMessage): x is ChatMessage {
  return x._getType() === "generic";
}

/**
 * @deprecated Use {@link ChatMessageChunk.isInstance} instead
 */
export function isChatMessageChunk(x: BaseMessageChunk): x is ChatMessageChunk {
  return x._getType() === "generic";
}
