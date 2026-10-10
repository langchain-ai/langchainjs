import type { EventSourceMessage } from "eventsource-parser/stream";
import type { StreamingChunkData } from "../converters/messages.js";
import { OpenRouterError } from "./errors.js";

/**
 * Web Streams `TransformStream` that sits between an `EventSourceParserStream`
 * and the streaming-response consumer. Each incoming SSE event has its `data`
 * field JSON-parsed into a typed {@link StreamingChunkData} object.
 *
 * Malformed or empty events are forwarded as `undefined` so the downstream
 * reader can skip them without the stream erroring out. Provider error events
 * fail the stream even when the HTTP response status was successful.
 */
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
            if (parsed?.error) {
              controller.error(
                new OpenRouterError(
                  parsed.error.message ?? "OpenRouter streaming error",
                  undefined,
                  parsed.error.code,
                  parsed.error.metadata
                )
              );
              return;
            }
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
