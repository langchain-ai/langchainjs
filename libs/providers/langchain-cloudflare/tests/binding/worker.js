import { ChatCloudflareWorkersAI } from "../../src/chat_models.js";

// Development-only fixture. Requests use a fixed synthetic prompt.
export default {
  async fetch(request, env) {
    const mode = new URL(request.url).pathname;
    if (!["/invoke", "/stream"].includes(mode)) {
      return new Response("Not found", { status: 404 });
    }
    const model = new ChatCloudflareWorkersAI({
      binding: env.AI,
      model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      maxRetries: 0,
    });
    const prompt = "Reply with only the word READY.";
    let text = "";
    if (mode === "/stream") {
      for await (const chunk of await model.stream(prompt)) {
        text += chunk.content;
      }
    } else {
      text = (await model.invoke(prompt)).content;
    }
    return Response.json({ text });
  },
};
