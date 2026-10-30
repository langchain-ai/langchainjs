/// <reference types="node" />
import { Readable } from "node:stream";
import { setImmediate } from "node:timers/promises";
import { describe, expect, test } from "vitest";
import { getBytes } from "../event_source_parse.js";

describe("getBytes", () => {
  test("waits for the Node stream to end before flushing", async () => {
    const first = new TextEncoder().encode("data: first\n\n");
    const second = new TextEncoder().encode("data: second\n\n");
    let releaseSecond!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    let receivedFirst!: () => void;
    const firstReceived = new Promise<void>((resolve) => {
      receivedFirst = resolve;
    });
    const source = Readable.from(
      (async function* () {
        yield first;
        await gate;
        yield second;
      })()
    );
    const chunks: Uint8Array[] = [];
    let flushCount = 0;
    let finished = false;
    const reading = getBytes(
      source as unknown as ReadableStream<Uint8Array>,
      (chunk, flush) => {
        if (flush) {
          flushCount += 1;
        } else {
          chunks.push(chunk);
          receivedFirst();
        }
      }
    ).then(() => {
      finished = true;
    });

    try {
      await firstReceived;
      await setImmediate();
      expect(finished).toBe(false);
      expect(flushCount).toBe(0);
      releaseSecond();
      await reading;
      expect(chunks).toEqual([first, second]);
      expect(flushCount).toBe(1);
    } finally {
      releaseSecond();
      source.destroy();
      await reading;
    }
  });

  test("rejects when a Node stream fails", async () => {
    const source = new Readable({ read() {} });
    const error = new Error("upstream connection lost");
    let observedError: unknown;
    const reading = getBytes(
      source as unknown as ReadableStream<Uint8Array>,
      () => {}
    ).catch((caught: unknown) => {
      observedError = caught;
    });
    const emitted = new Promise<void>((resolve) => {
      source.once("error", () => resolve());
    });

    source.destroy(error);
    await emitted;
    await setImmediate();
    expect(observedError).toBe(error);
    await reading;
  });

  test("flushes an empty Node stream once", async () => {
    const chunks: Uint8Array[] = [];
    let flushCount = 0;
    await getBytes(
      Readable.from([]) as unknown as ReadableStream<Uint8Array>,
      (chunk, flush) => {
        if (flush) flushCount += 1;
        else chunks.push(chunk);
      }
    );
    expect(chunks).toEqual([]);
    expect(flushCount).toBe(1);
  });

  test("continues to read and flush web streams", async () => {
    const input = new TextEncoder().encode("data: hello\n\n");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(input);
        controller.close();
      },
    });
    const chunks: Uint8Array[] = [];
    let flushCount = 0;
    await getBytes(stream, (chunk, flush) => {
      if (flush) flushCount += 1;
      else chunks.push(chunk);
    });
    expect(chunks).toEqual([input]);
    expect(flushCount).toBe(1);
  });
});
