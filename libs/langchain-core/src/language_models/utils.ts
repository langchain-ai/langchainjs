import { BaseMessage } from "../messages/base.js";

type Constructor<T> = new (...args: unknown[]) => T;

export const iife = <T>(fn: () => T): T => fn();

function castStandardMessageContent<T extends BaseMessage>(message: T) {
  const Cls = message.constructor as Constructor<T>;
  const fields = { ...message } as Record<string, unknown>;
  // Drop Serializable bookkeeping (lc_kwargs, lc_serializable, lc_namespace).
  // Passing it back into the constructor nests the old lc_kwargs inside the
  // new one, so toJSON() repeats the content at every level.
  for (const key of Object.keys(fields)) {
    if (key.startsWith("lc_")) delete fields[key];
  }
  return new Cls({
    ...fields,
    content: message.contentBlocks,
    response_metadata: {
      ...message.response_metadata,
      output_version: "v1",
    },
  });
}

export { castStandardMessageContent };
