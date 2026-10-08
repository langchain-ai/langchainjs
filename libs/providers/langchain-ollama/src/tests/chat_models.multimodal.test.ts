import { expect, test, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { ChatOllama } from "../chat_models.js";

test.each(["invoke", "stream", "streamEvents"] as const)(
  "ChatOllama.%s sends standard image blocks through the SDK",
  async (method) => {
    const imageBase64 = "iVBORw0KGgo=";
    const imageBytes = new Uint8Array([
      255, 137, 80, 78, 71, 13, 10, 26, 10, 255,
    ]).subarray(1, 9);
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      const response = {
        model: "llava",
        created_at: "2026-01-01T00:00:00Z",
        message: { role: "assistant", content: "An image." },
        done: true,
        done_reason: "stop",
        prompt_eval_count: 10,
        eval_count: 3,
      };
      return new Response(`${JSON.stringify(response)}\n`, {
        headers: { "Content-Type": "application/x-ndjson" },
      });
    });
    const model = new ChatOllama({
      model: "llava",
      fetch: fetchMock,
      checkOrPullModel: false,
    });
    const messages = [
      new HumanMessage({
        contentBlocks: [
          { type: "text", text: "Describe these images." },
          { type: "image", data: imageBase64, mimeType: "image/png" },
          { type: "image", data: imageBytes, mimeType: "image/png" },
          { type: "image", url: `data:image/png;base64,${imageBase64}` },
        ],
      }),
    ];

    if (method === "invoke") {
      expect((await model.invoke(messages)).text).toBe("An image.");
    } else if (method === "stream") {
      let text = "";
      for await (const chunk of await model.stream(messages)) {
        text += chunk.text;
      }
      expect(text).toBe("An image.");
    } else {
      const stream = model.streamEvents(messages);
      expect((await stream).text).toBe("An image.");
    }

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/chat");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "llava",
      stream: true,
      messages: [
        { role: "user", content: "Describe these images." },
        { role: "user", content: "", images: [imageBase64] },
        { role: "user", content: "", images: [imageBase64] },
        { role: "user", content: "", images: [imageBase64] },
      ],
    });
  }
);
