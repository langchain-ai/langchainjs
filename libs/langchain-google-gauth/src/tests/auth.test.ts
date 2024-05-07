import { expect, test, describe } from "@jest/globals";
import { Readable } from "stream";
import { NodeJsonStream } from "../auth.js";

describe("NodeJsonStream", () => {
  test("stream", async () => {
    const data = ["[", '{"i": 1}', '{"i', '": 2}', "]"];
    const source = new Readable({
      read() {
        if (data.length > 0) {
          this.push(Buffer.from(data.shift() || ""));
        } else {
          this.push(null);
        }
      },
    });
    const stream = new NodeJsonStream(source);
    expect(await stream.nextChunk()).toEqual({ i: 1 });
    expect(await stream.nextChunk()).toEqual({ i: 2 });
    expect(await stream.nextChunk()).toBeNull();
    expect(stream.streamDone).toEqual(true);
  });

  test("stream multibyte", async () => {
    const data = [
      "[",
      '{"i": 1, "msg":"hello👋"}',
      '{"i": 2,',
      '"msg":"こん',
      Buffer.from([0xe3]), // 1st byte of "に"
      Buffer.from([0x81, 0xab]), // 2-3rd bytes of "に"
      "ちは",
      Buffer.from([0xf0, 0x9f]), // first half bytes of "👋"
      Buffer.from([0x91, 0x8b]), // second half bytes of "👋"
      '"}',
      "]",
    ];
    const source = new Readable({
      read() {
        if (data.length > 0) {
          const next = data.shift();
          this.push(typeof next === "string" ? Buffer.from(next) : next);
        } else {
          this.push(null);
        }
      },
    });
    const stream = new NodeJsonStream(source);
    expect(await stream.nextChunk()).toEqual({ i: 1, msg: "hello👋" });
    expect(await stream.nextChunk()).toEqual({ i: 2, msg: "こんにちは👋" });
    expect(await stream.nextChunk()).toBeNull();
    expect(stream.streamDone).toEqual(true);
  });
});
