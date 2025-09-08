import {
  BaseMessage,
  BaseMessageChunk,
  type BaseMessageFields,
  mergeContent,
  _mergeDicts,
} from "./base.js";
import { $InferMessageContent, $MessageStructure } from "./message.js";
import { Constructor } from "./utils.js";

export interface FunctionMessageFields<
  TStructure extends $MessageStructure = $MessageStructure
> extends BaseMessageFields<TStructure, "function"> {
  name: string;
}

/**
 * Represents a function message in a conversation.
 */
export class FunctionMessage<
    TStructure extends $MessageStructure = $MessageStructure
  >
  extends BaseMessage<TStructure, "function">
  implements FunctionMessageFields<TStructure>
{
  static lc_name() {
    return "FunctionMessage";
  }

  readonly type = "function" as const;

  name: string;

  constructor(fields: FunctionMessageFields<TStructure>) {
    super(fields);
    this.name = fields.name;
  }
}

/**
 * Represents a chunk of a function message, which can be concatenated
 * with other function message chunks.
 */
export class FunctionMessageChunk<
  TStructure extends $MessageStructure = $MessageStructure
> extends BaseMessageChunk<TStructure, "function"> {
  static lc_name() {
    return "FunctionMessageChunk";
  }

  readonly type = "function" as const;

  concat(chunk: FunctionMessageChunk<TStructure>) {
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
      name: this.name ?? "",
      id: this.id ?? chunk.id,
    });
  }
}

export function isFunctionMessage(x: BaseMessage): x is FunctionMessage {
  return x._getType() === "function";
}

export function isFunctionMessageChunk(
  x: BaseMessageChunk
): x is FunctionMessageChunk {
  return x._getType() === "function";
}
