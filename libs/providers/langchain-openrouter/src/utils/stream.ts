import type { EventSourceMessage } from "eventsource-parser/stream";
import type { StreamingChunkData } from "../converters/messages.js";

export class OpenRouterJsonParseStream extends TransformStream<
  EventSourceMessage,
  StreamingChunkData
> {
  constructor() {
    super({
      transform(chunk, controller) {
        try {
          if (chunk.data) {
            const parsed = JSON.parse(chunk.data);
            controller.enqueue(parsed);
          } else {
            controller.enqueue(undefined);
          }
        } catch {
          // If parsing fails, enqueue null to indicate invalid JSON
          controller.enqueue(undefined);
        }
      },
    });
  }
}
