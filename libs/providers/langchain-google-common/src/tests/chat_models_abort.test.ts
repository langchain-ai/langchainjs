import { describe, expect, test } from "vitest";
import { GoogleAbstractedClient, GoogleAbstractedClientOps } from "../auth.js";
import { GoogleAIBaseLLMInput } from "../types.js";
import { ReadableJsonStream } from "../utils/stream.js";
import { authOptions, MockClient, type MockClientAuthInfo } from "./mock.js";
import { TestChatGoogle } from "./test_chat_google.js";

const PARTIAL_RESPONSE =
  '[{"candidates":[{"content":{"role":"model","parts":[{"text":"Hel"}]},"index":0}]}\n,';

// Sends the first chunk of a response, then stalls. Like fetch, the body
// errors with the signal's reason when the request is aborted.
class StallingClient extends MockClient {
  async request(opts: GoogleAbstractedClientOps): Promise<unknown> {
    const { signal } = opts;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(PARTIAL_RESPONSE));
        signal?.addEventListener(
          "abort",
          () => controller.error(signal.reason),
          { once: true }
        );
      },
    });
    return {
      data: new ReadableJsonStream(body),
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    };
  }
}

class StallingChatGoogle extends TestChatGoogle {
  buildAbstractedClient(
    fields?: GoogleAIBaseLLMInput<MockClientAuthInfo>
  ): GoogleAbstractedClient {
    return new StallingClient(authOptions(fields));
  }
}

describe("abort while streaming", () => {
  test("a timeout that fires mid-response rejects the stream and leaves no unhandled rejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);

    const model = new StallingChatGoogle();
    const texts: string[] = [];

    const drain = async () => {
      const stream = await model.stream("Hi", {
        signal: AbortSignal.timeout(50),
      });
      for await (const chunk of stream) {
        texts.push(chunk.text);
      }
    };

    try {
      await expect(drain()).rejects.toMatchObject({ name: "TimeoutError" });
      // Unhandled rejections are reported after the microtask queue drains.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(texts).toEqual(["Hel"]);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
