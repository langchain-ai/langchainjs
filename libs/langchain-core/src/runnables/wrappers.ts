import { IterableReadableStream } from "../utils/stream.js";

export function convertToHttpEventStream(stream: AsyncGenerator) {
  const encoder = new TextEncoder();
  const finalStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(
          encoder.encode(`event: data\ndata: ${JSON.stringify(chunk)}\n\n`)
        );
      }
      controller.enqueue(encoder.encode("event: end\n\n"));
      controller.close();
    },
  });
  return IterableReadableStream.fromReadableStream(finalStream);
}
