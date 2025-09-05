import { BaseMessage, BaseMessageFields } from "./base.js";
import { $MessageStructure, $StandardMessageStructure } from "./message.js";

export interface RemoveMessageFields
  extends Omit<BaseMessageFields, "content"> {
  /**
   * The ID of the message to remove.
   */
  id: string;
}

/**
 * Message responsible for deleting other messages.
 */
export class RemoveMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> extends BaseMessage<TStructure, "remove"> {
  readonly type = "remove" as const;

  /**
   * The ID of the message to remove.
   */
  id: string;

  constructor(fields: RemoveMessageFields) {
    super({
      ...fields,
      content: "",
    });
    this.id = fields.id;
  }

  override get _printableFields(): Record<string, unknown> {
    return {
      ...super._printableFields,
      id: this.id,
    };
  }
}
