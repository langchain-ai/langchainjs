/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test } from "@jest/globals";

import { RemoteRunnable } from "../runnable/remote.js";

const BASE_URL = "http://my-langserve-endpoint";

describe("RemoteRunnable", () => {
  beforeAll(() => {
    // mock langserve service
    const returnDataByEndpoint: Record<string, BodyInit> = {
      "/invoke": JSON.stringify({ output: ["a", "b", "c"] }),
      "/batch": JSON.stringify({
        output: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
      }),
      "/stream": new ReadableStream<Uint8Array>({
        start(controller) {
          const dataChunks = [
            "event: data",
            `data: ["a", "b", "c", "d"]\n`,
            "event: end",
          ];
          // Push chunks of data to the stream
          for (const chunk of dataChunks) {
            controller.enqueue(Buffer.from(`${chunk}\n`));
          }
          // Close the stream
          controller.close();
        },
      }),
    };

    const oldFetch = global.fetch;

    global.fetch = jest
      .fn()
      .mockImplementation(async (url: any, init?: any) => {
        if (!url.startsWith(BASE_URL)) return await oldFetch(url, init);
        const { pathname } = new URL(url);
        const resp: Response = new Response(returnDataByEndpoint[pathname]);
        return resp;
      }) as any;
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  test("Invoke local langserve", async () => {
    // mock fetch, expect /invoke
    const remote = new RemoteRunnable(BASE_URL);
    const result = await remote.invoke({ text: "string" });
    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/invoke`,
      expect.objectContaining({
        body: '{"input":{"text":"string"},"config":{},"kwargs":{}}',
      })
    );
    expect(result).toEqual(["a", "b", "c"]);
  });

  test("Batch local langserve", async () => {
    const returnData = [
      ["a", "b", "c"],
      ["d", "e", "f"],
    ];
    const remote = new RemoteRunnable(BASE_URL);
    const result = await remote.batch([{ text: "1" }, { text: "2" }]);
    expect(result).toEqual(returnData);
  });

  test("Stream local langserve", async () => {
    const remote = new RemoteRunnable(BASE_URL);
    const stream = await remote.stream({ text: "What are the 5 best apples?" });
    let chunkCount = 0;
    for await (const chunk of stream) {
      expect(chunk).toEqual(["a", "b", "c", "d"]);
      chunkCount += 1;
    }
    expect(chunkCount).toBe(1);
  });
});
