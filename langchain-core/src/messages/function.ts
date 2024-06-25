import {
  BaseMessage,
  BaseMessageChunk,
  type BaseMessageFields,
  mergeContent,
  _mergeDicts,
  type MessageType,
} from "./base.js";

export interface FunctionMessageFieldsWithName extends BaseMessageFields {
  name: string;
}

/**
 * Represents a function message in a conversation.
 */
export class FunctionMessage extends BaseMessage {
  static lc_name() {
    return "FunctionMessage";
  }

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

  _getType(): MessageType {
    return "function";
  }

  toString(): string {
    const idString = this.id ? `id: ${this.id}\n` : "";
    const nameString = this.name ? `name: ${this.name}\n` : "";
    const contentString = `content: ${typeof this.content === "string" ? this.content : JSON.stringify(this.content)}\n`;
    const functionCallString = this.additional_kwargs.function_call ? `function_call: ${JSON.stringify(this.additional_kwargs.function_call)}` : "";
    return `FunctionMessage: ${idString}${nameString}${contentString}${functionCallString}`
  }
}

/**
 * Represents a chunk of a function message, which can be concatenated
 * with other function message chunks.
 */
export class FunctionMessageChunk extends BaseMessageChunk {
  static lc_name() {
    return "FunctionMessageChunk";
  }

  _getType(): MessageType {
    return "function";
  }

  concat(chunk: FunctionMessageChunk) {
    return new FunctionMessageChunk({
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

  toString(): string {
    const idString = this.id ? `id: ${this.id}\n` : "";
    const nameString = this.name ? `name: ${this.name}\n` : "";
    const contentString = `content: ${typeof this.content === "string" ? this.content : JSON.stringify(this.content)}\n`;
    const functionCallString = this.additional_kwargs.function_call ? `function_call: ${JSON.stringify(this.additional_kwargs.function_call)}` : "";
    return `FunctionMessageChunk: ${idString}${nameString}${contentString}${functionCallString}`
  }
}
