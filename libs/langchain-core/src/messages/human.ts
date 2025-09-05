import {
  BaseMessage,
  BaseMessageChunk,
  mergeContent,
  _mergeDicts,
  type BaseMessageFields,
} from "./base.js";
import { $MessageStructure, $StandardMessageStructure } from "./message.js";
import { Constructor } from "./utils.js";

export type HumanMessageFields = BaseMessageFields;

/**
 * Represents a human message in a conversation.
 */
export class HumanMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> extends BaseMessage<TStructure, "human"> {
  static lc_name() {
    return "HumanMessage";
  }

  readonly type = "human" as const;

  constructor(
    fields: string | HumanMessageFields,
    /** @deprecated */
    kwargs?: Record<string, unknown>
  ) {
    super(fields, kwargs);
  }
}

/**
 * Represents a chunk of a human message, which can be concatenated with
 * other human message chunks.
 */
export class HumanMessageChunk<
  TStructure extends $MessageStructure = $StandardMessageStructure
> extends BaseMessageChunk<TStructure, "human"> {
  static lc_name() {
    return "HumanMessageChunk";
  }

  readonly type = "human" as const;

  constructor(
    fields: string | HumanMessageFields,
    /** @deprecated */
    kwargs?: Record<string, unknown>
  ) {
    super(fields, kwargs);
  }

  concat(chunk: HumanMessageChunk) {
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

export function isHumanMessage(x: BaseMessage): x is HumanMessage {
  return x.getType() === "human";
}

export function isHumanMessageChunk(
  x: BaseMessageChunk
): x is HumanMessageChunk {
  return x.getType() === "human";
}
