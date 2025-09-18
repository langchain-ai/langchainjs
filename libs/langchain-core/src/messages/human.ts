import {
  BaseMessage,
  BaseMessageChunk,
  mergeContent,
  _mergeDicts,
  type BaseMessageFields,
} from "./base.js";
import type { $InferMessageContent, MessageStructure } from "./message.js";
import { Constructor } from "../types/type-utils.js";

export interface HumanMessageFields<
  TStructure extends MessageStructure = MessageStructure
> extends BaseMessageFields<TStructure, "human"> {}

/**
 * Represents a human message in a conversation.
 */
export class HumanMessage<
  TStructure extends MessageStructure = MessageStructure
> extends BaseMessage<TStructure, "human"> {
  static lc_name() {
    return "HumanMessage";
  }

  readonly type = "human" as const;

  constructor(
    fields:
      | $InferMessageContent<TStructure, "human">
      | HumanMessageFields<TStructure>
  ) {
    super(fields);
  }

  static isInstance(obj: unknown): obj is HumanMessage {
    return super.isInstance(obj) && obj.type === "human";
  }
}

/**
 * Represents a chunk of a human message, which can be concatenated with
 * other human message chunks.
 */
export class HumanMessageChunk<
  TStructure extends MessageStructure = MessageStructure
> extends BaseMessageChunk<TStructure, "human"> {
  static lc_name() {
    return "HumanMessageChunk";
  }

  readonly type = "human" as const;

  constructor(
    fields:
      | $InferMessageContent<TStructure, "human">
      | HumanMessageFields<TStructure>
  ) {
    super(fields);
  }

  concat(chunk: HumanMessageChunk<TStructure>) {
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

  static isInstance(obj: unknown): obj is HumanMessageChunk {
    return super.isInstance(obj) && obj.type === "human";
  }
}

/**
 * @deprecated Use {@link HumanMessage.isInstance} instead
 */
export function isHumanMessage<TStructure extends MessageStructure>(
  x: BaseMessage
): x is HumanMessage<TStructure> {
  return x.getType() === "human";
}

/**
 * @deprecated Use {@link HumanMessageChunk.isInstance} instead
 */
export function isHumanMessageChunk<TStructure extends MessageStructure>(
  x: BaseMessageChunk
): x is HumanMessageChunk<TStructure> {
  return x.getType() === "human";
}
