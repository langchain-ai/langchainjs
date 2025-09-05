import {
  BaseMessage,
  BaseMessageChunk,
  mergeContent,
  _mergeDicts,
  type BaseMessageFields,
} from "./base.js";
import { $MessageStructure, $StandardMessageStructure } from "./message.js";
import { Constructor } from "./utils.js";

export type SystemMessageFields = BaseMessageFields;

/**
 * Represents a system message in a conversation.
 */
export class SystemMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> extends BaseMessage<TStructure, "system"> {
  readonly type = "system" as const;

  static lc_name() {
    return "SystemMessage";
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
export class SystemMessageChunk<
  TStructure extends $MessageStructure = $StandardMessageStructure
> extends BaseMessageChunk<TStructure, "system"> {
  readonly type = "system" as const;

  static lc_name() {
    return "SystemMessageChunk";
  }

  constructor(
    fields: string | SystemMessageFields,
    /** @deprecated */
    kwargs?: Record<string, unknown>
  ) {
    super(fields, kwargs);
  }

  concat(chunk: SystemMessageChunk) {
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
}

export function isSystemMessage(x: BaseMessage): x is SystemMessage {
  return x.type === "system";
}

export function isSystemMessageChunk(
  x: BaseMessageChunk
): x is SystemMessageChunk {
  return x.type === "system";
}
