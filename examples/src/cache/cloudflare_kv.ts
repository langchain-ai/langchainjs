import type { KVNamespace } from "@cloudflare/workers-types";

import { OpenAI } from "@langchain/openai";
import { CloudflareKVCache } from "@langchain/cloudflare";

export interface Env {
  KV_NAMESPACE: KVNamespace;
  OPENAI_API_KEY: string;
}

export default {
  async fetch(_request: Request, env: Env) {
    try {
      const cache = new CloudflareKVCache(env.KV_NAMESPACE);
      const model = new OpenAI({
        // @ts-expect-error - CloudflareKVCache is not typed correctly
        cache,
        model: "gpt-3.5-turbo-instruct",
        apiKey: env.OPENAI_API_KEY,
      });
      const response = await model.invoke("How are you today?");
      return new Response(JSON.stringify(response), {
        headers: { "content-type": "application/json" },
      });
    } catch (err: any) {
      console.log(err.message);
      return new Response(err.message, { status: 500 });
    }
  },
};
