import { BaseMessage, BaseMessageFields } from "./base.js";
import { $MessageStructure } from "./message.js";

export interface RemoveMessageFields<
  TStructure extends $MessageStructure = $MessageStructure
> extends Omit<BaseMessageFields<TStructure, "remove">, "content"> {
  /**
   * The ID of the message to remove.
   */
  id: string;
}

/**
 * Message responsible for deleting other messages.
 */
export class RemoveMessage<
  TStructure extends $MessageStructure = $MessageStructure
> extends BaseMessage<TStructure, "remove"> {
  readonly type = "remove" as const;

  /**
   * The ID of the message to remove.
   */
  id: string;

  constructor(fields: RemoveMessageFields<TStructure>) {
    super(fields);
    this.id = fields.id;
  }

  override get _printableFields(): Record<string, unknown> {
    return {
      ...super._printableFields,
      id: this.id,
    };
  }

  static isInstance(obj: unknown): obj is RemoveMessage {
    return super.isInstance(obj) && obj.type === "remove";
  }
}
