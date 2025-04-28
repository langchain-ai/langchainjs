import { BaseMessage, BaseMessageFields, MessageType } from "./base.js";

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
export class RemoveMessage extends BaseMessage {
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

  _getType(): MessageType {
    return "remove";
  }

  override get _printableFields(): Record<string, unknown> {
    return {
      ...super._printableFields,
      id: this.id,
    };
  }
}
