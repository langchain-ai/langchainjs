import type { VectorizeIndex, Ai, Request } from "@cloudflare/workers-types";

import {
  CloudflareVectorizeStore,
  CloudflareWorkersAIEmbeddings,
} from "@langchain/cloudflare";

export interface Env {
  VECTORIZE_INDEX: VectorizeIndex;
  AI: Ai;
}

export default {
  async fetch(request: Request, env: Env) {
    const { pathname } = new URL(request.url);
    const embeddings = new CloudflareWorkersAIEmbeddings({
      binding: env.AI,
      model: "@cf/baai/bge-small-en-v1.5",
    });
    const store = new CloudflareVectorizeStore(embeddings, {
      index: env.VECTORIZE_INDEX,
    });
    if (pathname === "/") {
      const results = await store.similaritySearch("hello", 5);
      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" },
      });
    } else if (pathname === "/load") {
      // Upsertion by id is supported
      await store.addDocuments(
        [
          {
            pageContent: "hello",
            metadata: {},
          },
          {
            pageContent: "world",
            metadata: {},
          },
          {
            pageContent: "hi",
            metadata: {},
          },
        ],
        { ids: ["id1", "id2", "id3"] }
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } else if (pathname === "/clear") {
      await store.delete({ ids: ["id1", "id2", "id3"] });
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};
