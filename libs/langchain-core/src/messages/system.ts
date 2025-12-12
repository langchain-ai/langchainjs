import {
  BaseMessage,
  BaseMessageChunk,
  mergeContent,
  _mergeDicts,
  type BaseMessageFields,
} from "./base.js";
import { $InferMessageContent, MessageStructure } from "./message.js";
import { Constructor } from "./utils.js";

export interface SystemMessageFields<
  TStructure extends MessageStructure = MessageStructure
> extends BaseMessageFields<TStructure, "system"> {}

/**
 * Represents a system message in a conversation.
 */
export class SystemMessage<
  TStructure extends MessageStructure = MessageStructure
> extends BaseMessage<TStructure, "system"> {
  static lc_name() {
    return "SystemMessage";
  }

  readonly type = "system" as const;

  constructor(
    fields:
      | $InferMessageContent<TStructure, "system">
      | SystemMessageFields<TStructure>
  ) {
    super(fields);
  }

  /**
   * Concatenates a string or another system message with the current system message.
   * @param chunk - The chunk to concatenate with the system message.
   * @returns A new system message with the concatenated content.
   */
  concat(chunk: string | SystemMessage) {
    if (typeof chunk === "string") {
      return new SystemMessage({
        ...this,
        content: mergeContent(this.content, chunk),
      });
    }

    if (SystemMessage.isInstance(chunk)) {
      return new SystemMessage({
        ...this,
        additional_kwargs: {
          ...this.additional_kwargs,
          ...chunk.additional_kwargs,
        },
        response_metadata: {
          ...this.response_metadata,
          ...chunk.response_metadata,
        },
        content: mergeContent(this.content, chunk.content),
      });
    }

    throw new Error("Unexpected chunk type for system message");
  }

  static isInstance(obj: unknown): obj is SystemMessage {
    return super.isInstance(obj) && obj.type === "system";
  }
}

/**
 * Represents a chunk of a system message, which can be concatenated with
 * other system message chunks.
 */
export class SystemMessageChunk<
  TStructure extends MessageStructure = MessageStructure
> extends BaseMessageChunk<TStructure, "system"> {
  static lc_name() {
    return "SystemMessageChunk";
  }

  readonly type = "system" as const;

  constructor(
    fields:
      | $InferMessageContent<TStructure, "system">
      | SystemMessageFields<TStructure>
  ) {
    super(fields);
  }

  concat(chunk: SystemMessageChunk<TStructure>) {
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
      id: this.id ?? chunk.id,
    });
  }

  static isInstance(obj: unknown): obj is SystemMessageChunk {
    return super.isInstance(obj) && obj.type === "system";
  }
}

/**
 * @deprecated Use {@link SystemMessage.isInstance} instead
 */
export function isSystemMessage<TStructure extends MessageStructure>(
  x: BaseMessage
): x is SystemMessage<TStructure> {
  return x._getType() === "system";
}

/**
 * @deprecated Use {@link SystemMessageChunk.isInstance} instead
 */
export function isSystemMessageChunk<TStructure extends MessageStructure>(
  x: BaseMessageChunk
): x is SystemMessageChunk<TStructure> {
  return x._getType() === "system";
}
