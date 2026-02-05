/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "vitest";
import { ChatDeepSeek } from "../chat_models.js";
import { AIMessageChunk } from "@langchain/core/messages";

test("ChatDeepSeek should separate <think> tags into reasoning_content", async () => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const chunks = [
        {
          id: "chatcmpl-123",
          object: "chat.completion.chunk",
          created: 1694268190,
          model: "deepseek-chat",
          choices: [
            { index: 0, delta: { content: "<think>" }, finish_reason: null },
          ],
        },
        {
          id: "chatcmpl-123",
          object: "chat.completion.chunk",
          created: 1694268190,
          model: "deepseek-chat",
          choices: [
            {
              index: 0,
              delta: { content: "thinking process..." },
              finish_reason: null,
            },
          ],
        },
        {
          id: "chatcmpl-123",
          object: "chat.completion.chunk",
          created: 1694268190,
          model: "deepseek-chat",
          choices: [
            { index: 0, delta: { content: "</think>" }, finish_reason: null },
          ],
        },
        {
          id: "chatcmpl-123",
          object: "chat.completion.chunk",
          created: 1694268190,
          model: "deepseek-chat",
          choices: [
            {
              index: 0,
              delta: { content: "Hello world" },
              finish_reason: null,
            },
          ],
        },
        {
          id: "chatcmpl-123",
          object: "chat.completion.chunk",
          created: 1694268190,
          model: "deepseek-chat",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        },
      ];

      for (const chunk of chunks) {
        const str = `data: ${JSON.stringify(chunk)}\n\n`;
        controller.enqueue(encoder.encode(str));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  const mockFetch = async () => {
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    });
  };

  const model = new ChatDeepSeek({
    apiKey: "test",
    configuration: {
      fetch: mockFetch as any,
    },
  });

  const chunks: AIMessageChunk[] = [];
  for await (const chunk of await model.stream("hi")) {
    chunks.push(chunk);
  }

  // Aggregate content
  const fullContent = chunks.map((c) => c.content).join("");
  const fullReasoning = chunks
    .map((c) => c.additional_kwargs.reasoning_content || "")
    .join("");

  // Expectation:
  // If the fix works, fullContent should be "Hello world" and fullReasoning should be "thinking process..."
  // If not, fullContent will contain tags.

  expect(fullContent).toBe("Hello world");
  expect(fullReasoning).toBe("thinking process...");
});

test("ChatDeepSeek should handle multiple think blocks and content before/after", async () => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const chunks = [
        { choices: [{ delta: { content: "Start " } }] },
        { choices: [{ delta: { content: "<think>" } }] },
        { choices: [{ delta: { content: "Reason 1" } }] },
        { choices: [{ delta: { content: "</think>" } }] },
        { choices: [{ delta: { content: " Middle " } }] },
        { choices: [{ delta: { content: "<think>" } }] },
        { choices: [{ delta: { content: "Reason 2" } }] },
        { choices: [{ delta: { content: "</think>" } }] },
        { choices: [{ delta: { content: " End" } }] },
        { choices: [{ finish_reason: "stop" }] },
      ];

      for (const chunk of chunks) {
        const str = `data: ${JSON.stringify({
          ...chunk,
          model: "deepseek-chat",
        })}\n\n`;
        controller.enqueue(encoder.encode(str));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  const mockFetch = async () =>
    new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  const model = new ChatDeepSeek({
    apiKey: "test",
    configuration: { fetch: mockFetch as any },
  });

  const chunks: AIMessageChunk[] = [];
  for await (const chunk of await model.stream("hi")) {
    chunks.push(chunk);
  }

  const fullContent = chunks.map((c) => c.content).join("");
  const fullReasoning = chunks
    .map((c) => c.additional_kwargs.reasoning_content || "")
    .join("");

  expect(fullContent).toBe("Start  Middle  End");
  expect(fullReasoning).toBe("Reason 1Reason 2");
});

test("ChatDeepSeek should handle unclosed think tags (flush at end)", async () => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const chunks = [
        { choices: [{ delta: { content: "Start " } }] },
        { choices: [{ delta: { content: "<think>" } }] },
        { choices: [{ delta: { content: "Unclosed thought" } }] },
        // No closing tag
        { choices: [{ finish_reason: "stop" }] },
      ];

      for (const chunk of chunks) {
        const str = `data: ${JSON.stringify({
          ...chunk,
          model: "deepseek-chat",
        })}\n\n`;
        controller.enqueue(encoder.encode(str));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  const mockFetch = async () =>
    new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  const model = new ChatDeepSeek({
    apiKey: "test",
    configuration: { fetch: mockFetch as any },
  });

  const chunks: AIMessageChunk[] = [];
  for await (const chunk of await model.stream("hi")) {
    chunks.push(chunk);
  }

  const fullReasoning = chunks
    .map((c) => c.additional_kwargs.reasoning_content || "")
    .join("");
  expect(fullReasoning).toBe("Unclosed thought");
});

test("ChatDeepSeek should handle split tags across chunks", async () => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const chunks = [
        { choices: [{ delta: { content: "<th" } }] }, // Partial start
        { choices: [{ delta: { content: "ink>Thought" } }] },
        { choices: [{ delta: { content: "</th" } }] }, // Partial end
        { choices: [{ delta: { content: "ink>" } }] },
        { choices: [{ finish_reason: "stop" }] },
      ];

      for (const chunk of chunks) {
        const str = `data: ${JSON.stringify({
          ...chunk,
          model: "deepseek-chat",
        })}\n\n`;
        controller.enqueue(encoder.encode(str));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  const mockFetch = async () =>
    new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  const model = new ChatDeepSeek({
    apiKey: "test",
    configuration: { fetch: mockFetch as any },
  });

  const chunks: AIMessageChunk[] = [];
  for await (const chunk of await model.stream("hi")) {
    chunks.push(chunk);
  }

  const fullReasoning = chunks
    .map((c) => c.additional_kwargs.reasoning_content || "")
    .join("");
  expect(fullReasoning).toBe("Thought");
});

test("ChatDeepSeek should handle empty think blocks", async () => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const chunks = [
        { choices: [{ delta: { content: "Before " } }] },
        { choices: [{ delta: { content: "<think>" } }] },
        { choices: [{ delta: { content: "</think>" } }] }, // Empty block
        { choices: [{ delta: { content: " After" } }] },
        { choices: [{ finish_reason: "stop" }] },
      ];

      for (const chunk of chunks) {
        const str = `data: ${JSON.stringify({
          ...chunk,
          model: "deepseek-chat",
        })}\n\n`;
        controller.enqueue(encoder.encode(str));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  const mockFetch = async () =>
    new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  const model = new ChatDeepSeek({
    apiKey: "test",
    configuration: { fetch: mockFetch as any },
  });

  const chunks: AIMessageChunk[] = [];
  for await (const chunk of await model.stream("hi")) {
    chunks.push(chunk);
  }

  const fullContent = chunks.map((c) => c.content).join("");
  const fullReasoning = chunks
    .map((c) => c.additional_kwargs.reasoning_content || "")
    .join("");

  expect(fullContent).toBe("Before  After");
  expect(fullReasoning).toBe("");
});

test("ChatDeepSeek should handle nested think tags (treat inner as content)", async () => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      // Nested <think> inside another - inner one should be treated as text
      const chunks = [
        { choices: [{ delta: { content: "<think>" } }] },
        { choices: [{ delta: { content: "Outer " } }] },
        { choices: [{ delta: { content: "<think>" } }] }, // Nested - treated as text
        { choices: [{ delta: { content: "Inner" } }] },
        { choices: [{ delta: { content: "</think>" } }] }, // Closes outer
        { choices: [{ delta: { content: " Content" } }] },
        { choices: [{ finish_reason: "stop" }] },
      ];

      for (const chunk of chunks) {
        const str = `data: ${JSON.stringify({
          ...chunk,
          model: "deepseek-chat",
        })}\n\n`;
        controller.enqueue(encoder.encode(str));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  const mockFetch = async () =>
    new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  const model = new ChatDeepSeek({
    apiKey: "test",
    configuration: { fetch: mockFetch as any },
  });

  const chunks: AIMessageChunk[] = [];
  for await (const chunk of await model.stream("hi")) {
    chunks.push(chunk);
  }

  const fullContent = chunks.map((c) => c.content).join("");
  const fullReasoning = chunks
    .map((c) => c.additional_kwargs.reasoning_content || "")
    .join("");

  // The first </think> closes the outer block, remaining " Content" goes to content
  expect(fullContent).toBe(" Content");
  expect(fullReasoning).toBe("Outer <think>Inner");
});

test("ChatDeepSeek should handle malformed tags gracefully", async () => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      // Malformed: </think> without opening, <think without closing >
      const chunks = [
        { choices: [{ delta: { content: "</think>" } }] }, // Orphan close - should go to content
        { choices: [{ delta: { content: "Text " } }] },
        { choices: [{ delta: { content: "<think" } }] }, // Incomplete tag (no >)
        { choices: [{ delta: { content: " more" } }] },
        { choices: [{ finish_reason: "stop" }] },
      ];

      for (const chunk of chunks) {
        const str = `data: ${JSON.stringify({
          ...chunk,
          model: "deepseek-chat",
        })}\n\n`;
        controller.enqueue(encoder.encode(str));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  const mockFetch = async () =>
    new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
  const model = new ChatDeepSeek({
    apiKey: "test",
    configuration: { fetch: mockFetch as any },
  });

  const chunks: AIMessageChunk[] = [];
  for await (const chunk of await model.stream("hi")) {
    chunks.push(chunk);
  }

  const fullContent = chunks.map((c) => c.content).join("");

  // Orphan </think> and incomplete <think should just be treated as content
  expect(fullContent).toContain("Text");
});
