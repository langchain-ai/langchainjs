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

export interface FunctionMessageFieldsWithName extends BaseMessageFields {
  name: string;
}

/**
 * Represents a function message in a conversation.
 */
export class FunctionMessage<
    TStructure extends $MessageStructure = $StandardMessageStructure
  >
  extends BaseMessage<TStructure, "function">
  implements FunctionMessageFieldsWithName
{
  static lc_name() {
    return "FunctionMessage";
  }

  readonly type = "function" as const;

  constructor(fields: FunctionMessageFieldsWithName);

  constructor(
    fields: string | BaseMessageFields,
    /** @deprecated */
    name: string
  );

  constructor(
    fields: string | FunctionMessageFieldsWithName,
    /** @deprecated */
    name?: string
  ) {
    if (typeof fields === "string") {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { content: fields, name: name! };
    }
    super(fields);
  }
}

/**
 * Represents a chunk of a function message, which can be concatenated
 * with other function message chunks.
 */
export class FunctionMessageChunk<
  TStructure extends $MessageStructure = $StandardMessageStructure
> extends BaseMessageChunk<TStructure, "function"> {
  static lc_name() {
    return "FunctionMessageChunk";
  }

  readonly type = "function" as const;

  concat(chunk: FunctionMessageChunk) {
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
  return x.type === "function";
}

export function isFunctionMessageChunk(
  x: BaseMessageChunk
): x is FunctionMessageChunk {
  return x.type === "function";
}
