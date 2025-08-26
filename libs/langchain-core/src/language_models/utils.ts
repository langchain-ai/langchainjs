import { BaseMessage } from "../messages/base.js";

type Constructor<T> = new (...args: unknown[]) => T;

function castStandardMessageContent<T extends BaseMessage>(message: T) {
  const Cls = message.constructor as Constructor<T>;
  return new Cls({
    ...message,
    content: message.contentBlocks,
    response_metadata: {
      ...message.response_metadata,
      output_version: "v1",
    },
  });
}

export { castStandardMessageContent };
