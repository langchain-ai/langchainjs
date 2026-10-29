import type { BaseMessage } from "./base.js";
import { HumanMessage } from "./human.js";

/** Which feature added a message, and that feature's fields. */
export interface NotificationMetadata {
  /** The feature that added the message, e.g. `"async_subagent"`. */
  source: string;
  /** The feature's fields, documented by that feature. */
  data?: Record<string, unknown>;
}

/**
 * Return a copy of `message` marked as added by the agent harness.
 *
 * Use it for a human message the user didn't type, such as a background task
 * update or a conversation summary. It sets `additional_kwargs.lc_source`
 * and, when `data` is given, `additional_kwargs.lc_data`. Any earlier
 * `lc_source` and `lc_data` are removed first. LangChain's chat model
 * integrations don't send these keys to the model.
 *
 * It doesn't change the content. Write the content the model reads yourself.
 *
 * Anyone who can send input to a thread can set these keys. Don't use them to
 * decide whether to trust a message.
 *
 * `mergeMessageRuns` and chunk `concat` join a notification with adjacent
 * human messages; the merged message keeps the metadata and concatenates
 * `lc_source`.
 *
 * @param message - The message to mark.
 * @param metadata - The feature that added the message and its fields. `data` must be JSON-serializable.
 * @returns A shallow copy of `message`, with the same `id`.
 *
 * @example
 * ```typescript
 * import { HumanMessage, addNotificationMetadata } from "@langchain/core/messages";
 *
 * const message = addNotificationMetadata(
 *   new HumanMessage("Background task t_42 finished."),
 *   { source: "async_subagent", data: { task_id: "t_42", status: "success" } }
 * );
 * ```
 */
export function addNotificationMetadata(
  message: HumanMessage,
  metadata: NotificationMetadata
): HumanMessage {
  const { lc_data: _, ...kwargs } = message.additional_kwargs ?? {};
  const additional_kwargs: Record<string, unknown> = {
    ...kwargs,
    lc_source: metadata.source,
  };
  if (metadata.data !== undefined) {
    additional_kwargs.lc_data = { ...metadata.data };
  }
  const {
    lc_kwargs: _kwargs,
    lc_serializable: _serializable,
    lc_namespace: _namespace,
    type: _type,
    ...fields
  } = message;
  return new HumanMessage({ ...fields, additional_kwargs });
}

/**
 * Return the notification metadata of `message`.
 *
 * @param message - The message to read.
 * @returns The metadata `addNotificationMetadata` set, or `undefined` for a
 * message without a string `lc_source`. `data` is a copy of `lc_data`, left out
 * unless `lc_data` is an object.
 */
export function getNotificationMetadata(
  message: BaseMessage
): NotificationMetadata | undefined {
  const source = message.additional_kwargs?.lc_source;
  if (typeof source !== "string") return undefined;
  const data = message.additional_kwargs?.lc_data;
  const isRecord =
    typeof data === "object" && data !== null && !Array.isArray(data);
  return isRecord
    ? { source, data: { ...(data as Record<string, unknown>) } }
    : { source };
}
