import { describe, it, expect, jest } from "@jest/globals";
import { AxiosResponse } from "axios";
import fetchAdapter from "../axios-fetch-adapter.js";

const mockFetchForOpenAIStream = async ({
  chunks,
  status,
  contentType,
}: {
  chunks: Array<string>;
  status: number;
  contentType: string;
}) => {
  // Mock stream response chunks.
  const stream = new ReadableStream({
    async start(controller) {
      chunks.forEach((chunk) => {
        controller.enqueue(new TextEncoder().encode(chunk));
      });
      controller.close();
    },
  });

  // Mock Fetch API call.
  jest.spyOn(global, "fetch").mockImplementation(
    async () =>
      new Response(stream, {
        status,
        headers: {
          "Content-Type": contentType,
        },
      })
  );

  let error: Error | null = null;
  let done = false;
  const receivedChunks: Array<string> = [];
  const resp = await fetchAdapter({
    url: "https://example.com",
    method: "POST",
    responseType: "stream",
    onmessage: (event: { data: string }) => {
      if (event.data?.trim?.() === "[DONE]") {
        done = true;
      } else {
        receivedChunks.push(
          JSON.parse(event.data).choices[0].delta.content ?? ""
        );
      }
    },
  } as unknown as never).catch((err) => {
    error = err;
    return null;
  });

  return { resp, receivedChunks, error, done } as {
    resp: AxiosResponse | null;
    receivedChunks: Array<string>;
    error: Error | null;
    done: boolean;
  };
};

describe("OpenAI Stream Tests", () => {
  it("should return a 200 response chunk by chunk", async () => {
    // When stream mode enabled, OpenAI responds with a stream of `data: {...}\n\n` chunks
    // followed by `data: [DONE]\n\n`.
    const { resp, receivedChunks, error, done } =
      await mockFetchForOpenAIStream({
        status: 200,
        contentType: "text/event-stream",
        chunks: [
          'data: {"choices":[{"delta":{"role":"assistant"},"index":0,"finish_reason":null}]}\n\n',
          'data: {"choices":[{"delta":{"content":"Hello"},"index":0,"finish_reason":null}]}\n\n',
          'data: {"choices":[{"delta":{"content":" World"},"index":0,"finish_reason":null}]}\n\n',
          'data: {"choices":[{"delta":{"content":"!"},"index":0,"finish_reason":null}]}\n\n',
          'data: {"choices":[{"delta":{},"index":0,"finish_reason":"stop"}]}\n\n',
          "data: [DONE]\n\n",
        ],
      });

    expect(error).toEqual(null);
    expect(resp?.status).toEqual(200);
    expect(receivedChunks).toEqual(["", "Hello", " World", "!", ""]);
    expect(done).toBe(true);
  });

  it("should handle OpenAI 400 json error", async () => {
    // OpenAI returns errors with application/json content type.
    // Even if stream mode is enabled, the error is returned as a normal JSON body.
    // Error information is in the `error` field.
    const { resp, receivedChunks, error } = await mockFetchForOpenAIStream({
      status: 400,
      contentType: "application/json",
      chunks: [
        JSON.stringify({
          error: {},
        }),
      ],
    });

    expect(error).toEqual(null);
    expect(resp?.status).toEqual(400);
    expect(resp?.data).toEqual({ error: {} });
    expect(receivedChunks).toEqual([]);
  });

  it("should handle 500 non-json error", async () => {
    const { resp, receivedChunks, error } = await mockFetchForOpenAIStream({
      status: 500,
      contentType: "text/plain",
      chunks: ["Some error message..."],
    });
    expect(error).toEqual(null);
    expect(resp?.status).toEqual(500);
    expect(resp?.data).toEqual("Some error message...");
    expect(receivedChunks).toEqual([]);
  });

  it("should throw on 500 non-json body with json content type", async () => {
    const { resp, receivedChunks, error } = await mockFetchForOpenAIStream({
      status: 500,
      contentType: "application/json",
      chunks: ["a non-json error body"],
    });
    expect(resp).toEqual(null);
    expect(error?.message).toContain("Unexpected token");
    expect(receivedChunks).toEqual([]);
  });

  it("should throw the generic error if non-stream content is detected", async () => {
    const { resp, receivedChunks, error } = await mockFetchForOpenAIStream({
      status: 200,
      contentType: "text/plain",
      chunks: ["a non-stream body"],
    });
    expect(resp).toEqual(null);
    expect(error?.message).toBe(
      "Expected content-type to be text/event-stream, Actual: text/plain"
    );
    expect(receivedChunks).toEqual([]);
  });
});

describe("Azure OpenAI Stream Tests", () => {
  it("should return a 200 response chunk by chunk", async () => {
    // When stream mode enabled, Azure OpenAI responds with chunks without tailing blank line.
    // In addition, Azure sends chunks in batch.
    const { resp, receivedChunks, error, done } =
      await mockFetchForOpenAIStream({
        status: 200,
        contentType: "text/event-stream",
        chunks: [
          // First batch
          'data: {"choices":[{"delta":{"role":"assistant"},"index":0,"finish_reason":null}]}\n\n' +
            'data: {"choices":[{"delta":{"content":"Hello"},"index":0,"finish_reason":null}]}\n\n' +
            'data: {"choices":[{"delta":{"content":" World"},"index":0,"finish_reason":null}]}\n\n',
          // Second batch
          'data: {"choices":[{"delta":{"content":"!"},"index":0,"finish_reason":null}]}\n\n' +
            'data: {"choices":[{"delta":{},"index":0,"finish_reason":"stop"}]}\n\n' +
            "data: [DONE]\n", // no blank line
        ],
      });

    expect(error).toEqual(null);
    expect(resp?.status).toEqual(200);
    expect(receivedChunks).toEqual(["", "Hello", " World", "!", ""]);
    expect(done).toBe(true);
  });
});
