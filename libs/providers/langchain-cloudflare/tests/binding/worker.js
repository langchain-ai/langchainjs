import images from "./images.json";
import { ChatCloudflareWorkersAI } from "../../src/chat_models.js";

// Development-only fixture. Requests use a fixed synthetic prompt.
export default {
  async fetch(request, env) {
    const mode = new URL(request.url).pathname;
    if (
      ![
        "/invoke",
        "/stream",
        "/gemma",
        "/gemma-stream",
        "/tools",
        "/tools-stream",
        "/json-schema",
        "/json-mode",
        "/json-schema-stream",
        "/structured-tool",
        "/vision",
        "/tools-events",
        "/tools-content-events",
      ].includes(mode)
    ) {
      return new Response("Not found", { status: 404 });
    }
    const model = new ChatCloudflareWorkersAI({
      binding: env.AI,
      model:
        mode === "/invoke" || mode === "/stream"
          ? "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
          : "@cf/google/gemma-4-26b-a4b-it",
      maxTokens: 512,
      temperature: 0,
      modelKwargs: { chat_template_kwargs: { enable_thinking: false } },
      maxRetries: 0,
    });
    if (mode === "/vision") {
      const result = await model.invoke([
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe the shape and color in each image, in Japanese, in one sentence.",
            },
            ...images.map((image) => ({
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${image}` },
            })),
          ],
        },
      ]);
      return Response.json({
        text: result.content,
        usage: result.usage_metadata,
      });
    }
    if (mode === "/json-schema-stream") model.streaming = true;
    const schema = {
      type: "object",
      properties: { answer: { type: "string" } },
      required: ["answer"],
      additionalProperties: false,
    };
    if (mode.startsWith("/json-") || mode === "/structured-tool") {
      const result = await model
        .withStructuredOutput(schema, {
          method:
            mode === "/structured-tool"
              ? "functionCalling"
              : mode === "/json-mode"
                ? "jsonMode"
                : "jsonSchema",
          name: "answer",
        })
        .invoke('Return a JSON object with answer set to "READY".');
      return Response.json(result);
    }
    if (mode.startsWith("/tools")) {
      const bound = model.bindTools(
        [
          {
            type: "function",
            function: {
              name: "lookup",
              description: "Look up a synthetic shape",
              parameters: {
                type: "object",
                properties: { color: { type: "string" } },
                required: ["color"],
              },
            },
          },
        ],
        { tool_choice: "lookup" }
      );
      const prompt = "Call lookup for the color red.";
      let result;
      if (mode === "/tools-stream") {
        for await (const chunk of await bound.stream(prompt))
          result = result ? result.concat(chunk) : chunk;
      } else if (mode === "/tools-content-events") {
        result = await model.streamEvents(prompt, {
          tools: [
            {
              type: "function",
              function: {
                name: "lookup",
                description: "Look up a synthetic shape",
                parameters: {
                  type: "object",
                  properties: { color: { type: "string" } },
                  required: ["color"],
                },
              },
            },
          ],
          tool_choice: "lookup",
        });
      } else if (mode === "/tools-events") {
        for await (const event of bound.streamEvents(prompt, {
          version: "v2",
        })) {
          if (event.event === "on_chat_model_end") result = event.data.output;
        }
      } else result = await bound.invoke(prompt);
      const call = result.tool_calls[0];
      if (!call) throw new Error("No tool call returned");
      const final = await model.invoke([
        ["human", prompt],
        result,
        {
          role: "tool",
          content: "The shape is a red circle.",
          tool_call_id: call.id,
        },
        [
          "human",
          "What shape did the tool find? Reply in Japanese in one sentence.",
        ],
      ]);
      return Response.json({
        calls: result.tool_calls,
        answer: final.content,
        usage: final.usage_metadata,
      });
    }
    const prompt = "Reply with only the word READY.";
    let text = "";
    if (mode === "/stream" || mode === "/gemma-stream") {
      for await (const chunk of await model.stream(prompt)) {
        text += chunk.content;
      }
    } else {
      text = (await model.invoke(prompt)).content;
    }
    return Response.json({ text });
  },
};
