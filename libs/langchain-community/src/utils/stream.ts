import { IterableReadableStream } from "@langchain/core/utils/stream";

export async function *createStream<T = unknown>(responseBody: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const stream = IterableReadableStream.fromReadableStream(responseBody);
    const decoder = new TextDecoder("utf-8");
    let extra = "";
    for await (const chunk of stream) {
      const decoded = extra + decoder.decode(chunk);
      const lines = decoded.split("\n");
      extra = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) {
          continue;
        }
        try {
          yield JSON.parse(line.slice("data:".length).trim());
        } catch (e) {
          console.warn(`Received a non-JSON parseable chunk: ${line}`);
        }
      }
    }
}