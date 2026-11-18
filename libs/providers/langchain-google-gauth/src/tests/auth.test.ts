import { expect, test, describe } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "stream";
import { OAuth2Client } from "google-auth-library";
import { GAuthClient, NodeJsonStream } from "../auth.js";

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

describe("GAuthClient", () => {
  test("includes the Google error body when a request is rejected", async () => {
    const googleError =
      "Schema.ref '#/definitions/nope' was not found in the root Schema.defs.";
    const server = createServer((_req, res) => {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify([
          {
            error: {
              code: 400,
              message: googleError,
              status: "INVALID_ARGUMENT",
            },
          },
        ])
      );
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    const authClient = new OAuth2Client();
    authClient.setCredentials({
      access_token: "test-token",
      expiry_date: Date.now() + 3_600_000,
    });
    const client = new GAuthClient({ authOptions: { authClient } });

    try {
      await expect(
        client.request({
          url: `http://127.0.0.1:${port}/v1/models/gemini:streamGenerateContent`,
          method: "POST",
          data: {},
          responseType: "stream",
        })
      ).rejects.toThrow(googleError);
    } finally {
      server.close();
    }
  });
});
