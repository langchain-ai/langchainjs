/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, test, expect, describe, beforeEach, afterEach } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
} from "../../messages/index.js";

import { RemoteRunnable } from "../remote.js";
import { ChatPromptValue } from "../../prompt_values.js";
import { PromptTemplate } from "../../prompts/prompt.js";

const BASE_URL = "http://my-langserve-endpoint";

function respToStream(resp: string): ReadableStream<Uint8Array> {
  const chunks = resp.split("\n");
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(Buffer.from(`${chunk}\n`));
      }
      controller.close();
    },
  });
}

const aResp = `event: data
data: ["a", "b", "c", "d"]

event: end`;

const bResp = `event: data
data: {"content": "", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": "\\"", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": "object", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": "1", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": ",", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": " object", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": "2", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": ",", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": " object", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": "3", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": ",", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": " object", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": "4", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": ",", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": " object", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": "5", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": "\\"", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: data
data: {"content": "", "additional_kwargs": {}, "type": "AIMessageChunk", "example": false}

event: end`;

const strangeTypesResp = `event: data
data: {"content": "what is a document loader", "additional_kwargs": {}, "type": "human", "example": false}

event: data
data: {"messages":[{"content":"You are an expert programmer and problem-solver, tasked with answering any question about Langchain.","type":"system","additional_kwargs":{}},{"content":"I am an AI","type":"ai","additional_kwargs":{}}]}

event: end`;

describe("RemoteRunnable", () => {
  beforeEach(() => {
    // mock langserve service
    const returnDataByEndpoint: Record<string, BodyInit> = {
      "/a/invoke": JSON.stringify({ output: ["a", "b", "c"] }),
      "/a/batch": JSON.stringify({
        output: [
          ["a", "b", "c"],
          ["d", "e", "f"],
        ],
      }),
      "/a/stream": respToStream(aResp),
      "/b/stream": respToStream(bResp),
      "/strange_types/stream": respToStream(strangeTypesResp),
    };

    const oldFetch = global.fetch;

    global.fetch = vi.fn().mockImplementation(async (url: any, init?: any) => {
      if (!url.startsWith(BASE_URL)) return await oldFetch(url, init);
      const { pathname } = new URL(url);
      const resp: Response = new Response(returnDataByEndpoint[pathname]);
      return resp;
    }) as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("Invoke local langserve", async () => {
    // mock fetch, expect /invoke
    const remote = new RemoteRunnable({ url: `${BASE_URL}/a` });
    const result = await remote.invoke({ text: "string" });
    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/a/invoke`,
      expect.objectContaining({
        body: '{"input":{"text":"string"},"config":{"tags":[],"metadata":{},"recursionLimit":25},"kwargs":{}}',
      })
    );
    expect(result).toEqual(["a", "b", "c"]);
  });

  test("Invoke local langserve passing a configurable object", async () => {
    // mock fetch, expect /invoke
    const remote = new RemoteRunnable({ url: `${BASE_URL}/a` });
    const result = await remote.invoke(
      { text: "string" },
      {
        configurable: {
          destination: "destination",
          integration_id: "integration_id",
          user_id: "user_id",
        },
      }
    );
    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/a/invoke`,
      expect.objectContaining({
        body: expect.any(String),
      })
    );
    expect(result).toEqual(["a", "b", "c"]);
  });

  test("Batch local langserve", async () => {
    const returnData = [
      ["a", "b", "c"],
      ["d", "e", "f"],
    ];
    const remote = new RemoteRunnable({ url: `${BASE_URL}/a` });
    const result = await remote.batch([{ text: "1" }, { text: "2" }]);
    expect(result).toEqual(returnData);
  });

  test("Stream local langserve", async () => {
    const remote = new RemoteRunnable({ url: `${BASE_URL}/a` });
    const stream = await remote.stream({ text: "What are the 5 best apples?" });
    let chunkCount = 0;
    for await (const chunk of stream) {
      expect(chunk).toEqual(["a", "b", "c", "d"]);
      chunkCount += 1;
    }
    expect(chunkCount).toBe(1);
  });

  test("Stream model output", async () => {
    const remote = new RemoteRunnable({ url: `${BASE_URL}/b` });
    const stream = await remote.stream({ text: "What are the 5 best apples?" });
    let chunkCount = 0;
    let accumulator: AIMessageChunk | null = null;
    for await (const chunk of stream) {
      const innerChunk = chunk as AIMessageChunk;
      accumulator = accumulator ? accumulator.concat(innerChunk) : innerChunk;
      chunkCount += 1;
    }
    expect(chunkCount).toBe(18);
    expect(accumulator?.content).toEqual(
      '"object1, object2, object3, object4, object5"'
    );
  });

  test("Stream legacy data type formats", async () => {
    const remote = new RemoteRunnable({ url: `${BASE_URL}/strange_types` });
    const stream = await remote.stream({ text: "What are the 5 best apples?" });
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks[0]).toBeInstanceOf(HumanMessage);
    expect(chunks[1]).toBeInstanceOf(ChatPromptValue);
    expect((chunks[1] as ChatPromptValue).messages[0]).toBeInstanceOf(
      SystemMessage
    );
    expect((chunks[1] as ChatPromptValue).messages[1]).toBeInstanceOf(
      AIMessage
    );
  });

  test("Streaming in a chain with model output", async () => {
    const remote = new RemoteRunnable({ url: `${BASE_URL}/b` });
    const prompt = PromptTemplate.fromTemplate("");
    const chunks = await prompt
      .pipe(remote)
      .stream({ text: "What are the 5 best apples?" });
    let chunkCount = 0;
    let accumulator: AIMessageChunk | null = null;
    for await (const chunk of chunks) {
      const innerChunk = chunk as AIMessageChunk;
      accumulator = accumulator ? accumulator.concat(innerChunk) : innerChunk;
      chunkCount += 1;
    }
    expect(chunkCount).toBe(18);
    expect(accumulator?.content).toEqual(
      '"object1, object2, object3, object4, object5"'
    );
  });
});
