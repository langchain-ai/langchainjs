import { EventSourceMessage } from "eventsource-parser/stream";

/**
 * A transform stream that safely parses JSON from EventSource messages.
 *
 * This stream takes EventSourceMessage objects and attempts to parse the `data`
 * field as JSON. If parsing fails, it passes through the original message.
 */
export class SafeJsonEventParserStream<T> extends TransformStream<
  EventSourceMessage,
  T | null
> {
  constructor() {
    super({
      transform(chunk, controller) {
        try {
          if (chunk.data) {
            const parsed = JSON.parse(chunk.data);
            controller.enqueue(parsed);
          } else {
            controller.enqueue(null);
          }
        } catch {
          // If parsing fails, enqueue null to indicate invalid JSON
          controller.enqueue(null);
        }
      },
    });
  }
}
