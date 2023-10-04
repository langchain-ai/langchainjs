import type { KVNamespace } from "@cloudflare/workers-types";

import { ChatOpenAI } from "langchain/chat_models/openai";
import { CloudflareKVCache } from "langchain/cache/cloudflare_kv";

export interface Env {
  KV_NAMESPACE: KVNamespace;
  OPENAI_API_KEY: string;
}

export default {
  async fetch(_request: Request, env: Env) {
    try {
      const cache = new CloudflareKVCache(env.KV_NAMESPACE);
      const model = new ChatOpenAI({
        cache,
        modelName: "gpt-3.5-turbo",
        openAIApiKey: env.OPENAI_API_KEY,
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
