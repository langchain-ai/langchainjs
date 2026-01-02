
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
                    choices: [{ index: 0, delta: { content: "<think>" }, finish_reason: null }],
                },
                {
                    id: "chatcmpl-123",
                    object: "chat.completion.chunk",
                    created: 1694268190,
                    model: "deepseek-chat",
                    choices: [{ index: 0, delta: { content: "thinking process..." }, finish_reason: null }],
                },
                {
                    id: "chatcmpl-123",
                    object: "chat.completion.chunk",
                    created: 1694268190,
                    model: "deepseek-chat",
                    choices: [{ index: 0, delta: { content: "</think>" }, finish_reason: null }],
                },
                {
                    id: "chatcmpl-123",
                    object: "chat.completion.chunk",
                    created: 1694268190,
                    model: "deepseek-chat",
                    choices: [{ index: 0, delta: { content: "Hello world" }, finish_reason: null }],
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
            headers: { "Content-Type": "text/event-stream" }
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
