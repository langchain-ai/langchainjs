import type { EventSourceMessage } from "eventsource-parser/stream";
import type { StreamingChunkData } from "../converters/messages.js";

export class OpenRouterJsonParseStream extends TransformStream<
  EventSourceMessage,
  StreamingChunkData
> {
  constructor() {
    super({
      transform(event, controller) {
        if (!event.data || event.data === "[DONE]") return;
        try {
          const parsed = JSON.parse(event.data) as StreamingChunkData;
          controller.enqueue(parsed);
        } catch {
          // Ignore malformed chunks
        }
      },
    });
  }
}
