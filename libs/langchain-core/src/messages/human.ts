import {
  BaseMessage,
  BaseMessageChunk,
  mergeContent,
  _mergeDicts,
  type BaseMessageFields,
  type MessageContent,
} from "./base.js";
import type { $InferMessageContent, MessageStructure } from "./message.js";
import { Constructor } from "./utils.js";

export interface HumanMessageFields<
  TStructure extends MessageStructure = MessageStructure,
> extends BaseMessageFields<TStructure, "human"> {}

/**
 * Represents a human message in a conversation.
 */
export class HumanMessage<
  TStructure extends MessageStructure = MessageStructure,
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

  static [Symbol.hasInstance](obj: unknown) {
    return this.isInstance(obj);
  }
}

/**
 * Represents a chunk of a human message, which can be concatenated with
 * other human message chunks.
 */
export class HumanMessageChunk<
  TStructure extends MessageStructure = MessageStructure,
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

  static [Symbol.hasInstance](obj: unknown) {
    return this.isInstance(obj);
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

/** First line of a notification's content. */
export const NOTIFICATION_HEADER = "[SYSTEM NOTIFICATION - NOT USER INPUT]";

/**
 * Options for `createNotificationMessage`.
 *
 * @experimental
 */
export interface NotificationMessageOptions {
  /** Which feature added the message. */
  source: string;
  /** Fields for code that handles this source. Must be JSON-serializable. */
  data?: Record<string, unknown>;
  /** A line shown to the model under the header. */
  note?: string;
  /** Prefix the content with `NOTIFICATION_HEADER`. Defaults to `true`. */
  header?: boolean;
  /** The message ID. */
  id?: string;
}

/**
 * Create a message the agent harness adds to the conversation.
 *
 * Use it for content the user didn't type, such as a background task update or
 * a conversation summary. It sets these `additional_kwargs` keys, which chat
 * model integrations don't send to the model:
 *
 * - `lc_synthetic`: `true`.
 * - `lc_source`: the feature that added the message, e.g. `"async_subagent"`.
 * - `lc_data`: that feature's fields, when given.
 *
 * Anyone who can send input to a thread can set these keys. Don't use them to
 * decide whether to trust a message.
 *
 * `mergeMessageRuns` and chunk `concat` join a notification with adjacent human
 * messages; the merged message keeps `lc_synthetic` and concatenates `lc_source`.
 *
 * Beta: the keys and header may change.
 *
 * @experimental
 *
 * @param content - The text or content blocks the model reads. Escape untrusted input.
 * @param options - The message's source, data, note, header and ID.
 * @returns A `HumanMessage`.
 * @throws If `note` is given with `header: false`.
 *
 * @example
 * ```typescript
 * import { createNotificationMessage } from "@langchain/core/messages";
 *
 * const message = createNotificationMessage("<task-id>t_42</task-id>", {
 *   source: "async_subagent",
 *   data: { task_id: "t_42", status: "success" },
 *   note: "A background task you started has an update.",
 * });
 * ```
 */
export function createNotificationMessage(
  content: MessageContent,
  options: NotificationMessageOptions
): HumanMessage {
  const { source, data, note, header = true, id } = options;
  if (note && !header) {
    throw new Error("`note` requires `header: true`.");
  }
  const additional_kwargs: Record<string, unknown> = {
    lc_synthetic: true,
    lc_source: source,
  };
  if (data !== undefined) {
    additional_kwargs.lc_data = { ...data };
  }
  if (!header) {
    return new HumanMessage({ content, additional_kwargs, id });
  }
  const intro = note ? `${NOTIFICATION_HEADER}\n${note}` : NOTIFICATION_HEADER;
  const body: MessageContent =
    typeof content === "string"
      ? `${intro}\n${content}`
      : [{ type: "text", text: `${intro}\n` }, ...content];
  return new HumanMessage({ content: body, additional_kwargs, id });
}
