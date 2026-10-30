import { describe, expect, it, vi } from "vitest";
import { ChatOpenAI } from "../index.js";

function mockResponse(useResponsesApi: boolean, streaming: boolean): Response {
  const usage = { input_tokens: 2, output_tokens: 1, total_tokens: 3 };
  const response = {
    id: "resp_test",
    object: "response",
    created_at: 0,
    model: "test-model",
    status: "completed",
    output: [
      {
        id: "msg_test",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: "Hello", annotations: [] }],
      },
    ],
    usage,
  };
  const completion = {
    id: "chatcmpl_test",
    object: "chat.completion",
    created: 0,
    model: "test-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Hello" },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
  };

  if (!streaming) {
    return new Response(
      JSON.stringify(useResponsesApi ? response : completion),
      {
        headers: { "content-type": "application/json" },
      }
    );
  }

  const events = useResponsesApi
    ? [
        { type: "response.created", response: { ...response, output: [] } },
        {
          type: "response.output_text.delta",
          delta: "Hello",
          content_index: 0,
          output_index: 0,
        },
        { type: "response.completed", response },
      ]
    : [
        {
          ...completion,
          object: "chat.completion.chunk",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: "Hello" },
              finish_reason: "stop",
            },
          ],
        },
      ];

  return new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    { headers: { "content-type": "text/event-stream" } }
  );
}

describe.each([
  { api: "Chat Completions", useResponsesApi: false },
  { api: "Responses", useResponsesApi: true },
])("$api request options", ({ useResponsesApi }) => {
  it.each(["invoke", "stream", "streamEvents"] as const)(
    "forwards per-call headers and query parameters through %s",
    async (method) => {
      const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { stream?: boolean };
        return mockResponse(useResponsesApi, body.stream === true);
      });
      const model = new ChatOpenAI({
        model: "test-model",
        apiKey: "test-key",
        useResponsesApi,
        maxRetries: 0,
        configuration: {
          fetch,
          defaultHeaders: { "x-shared": "default", "x-default": "retained" },
        },
      });
      const callOptions = {
        options: {
          headers: { "x-shared": "call", "x-custom-header": "present" },
          query: { trace_id: "request-test" },
        },
      };

      if (method === "invoke") {
        const result = await model.invoke("Hello", callOptions);
        expect(result.text).toBe("Hello");
      } else if (method === "stream") {
        const stream = await model.stream("Hello", callOptions);
        let text = "";
        for await (const chunk of stream) {
          text += chunk.text;
        }
        expect(text).toBe("Hello");
      } else {
        let text = "";
        for await (const token of model.streamEvents("Hello", callOptions)
          .text) {
          text += token;
        }
        expect(text).toBe("Hello");
      }

      expect(fetch).toHaveBeenCalledTimes(1);
      const [input, init] = fetch.mock.calls[0];
      const headers = new Headers(init?.headers);
      expect(headers.get("x-custom-header")).toBe("present");
      expect(headers.get("x-shared")).toBe("call");
      expect(headers.get("x-default")).toBe("retained");
      const url = new URL(input instanceof Request ? input.url : input);
      expect(url.searchParams.get("trace_id")).toBe("request-test");
    }
  );
});
