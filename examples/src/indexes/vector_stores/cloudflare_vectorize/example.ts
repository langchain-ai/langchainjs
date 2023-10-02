// @ts-nocheck

import type {
  VectorizeIndex,
  Fetcher,
  Request,
} from "@cloudflare/workers-types";

import { CloudflareVectorizeStore } from "langchain/vectorstores/cloudflare_vectorize";
import { CloudflareWorkersAIEmbeddings } from "langchain/embeddings/cloudflare_workersai";

export interface Env {
  VECTORIZE_INDEX: VectorizeIndex;
  AI: Fetcher;
}

export default {
  async fetch(request: Request, env: Env) {
    const { pathname } = new URL(request.url);
    const embeddings = new CloudflareWorkersAIEmbeddings({
      binding: env.AI,
      modelName: "@cf/baai/bge-small-en-v1.5",
    });
    const store = new CloudflareVectorizeStore(embeddings, {
      index: env.VECTORIZE_INDEX,
    });
    if (pathname === "/") {
      const results = await store.similaritySearch("hello", 5);
      return Response.json(results);
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

      return Response.json({ success: true });
    } else if (pathname === "/clear") {
      await store.delete({ ids: ["id1", "id2", "id3"] });
      return Response.json({ success: true });
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  },
};
