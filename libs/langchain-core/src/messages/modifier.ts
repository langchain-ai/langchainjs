import { BaseMessage, BaseMessageFields } from "./base.js";

export interface RemoveMessageFields extends Omit<
  BaseMessageFields,
  "content"
> {
  /**
   * The ID of the message to remove.
   */
  id: string;
}

/**
 * Message responsible for deleting other messages.
 *
 * `RemoveMessage` is intentionally not generic over `MessageStructure`.
 * Its content is always `[]` (empty), so carrying a structure type parameter
 * would only cause unnecessary type incompatibilities when mixing messages
 * from different structure configurations (e.g. passing a `RemoveMessage`
 * into an API that expects `Message<CustomToolCall>`).
 */
export class RemoveMessage extends BaseMessage {
  readonly type = "remove" as const;

  /**
   * The ID of the message to remove.
   */
  id: string;

  constructor(fields: RemoveMessageFields) {
    super({
      ...fields,
      content: [],
    });
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
