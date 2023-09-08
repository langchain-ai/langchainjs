import type { KVNamespace } from '@cloudflare/workers-types'

import { OpenAI } from "langchain/llms/openai";
import { CloudflareKVCache } from "langchain/cache/cloudflare_kv";

interface Env {
  KV_NAMESPACE: KVNamespace;
}

export default {
  // CloudflareKVCache must be instantiated with a KVNamespace
  // binding inside of the env object, passed to the fetch method.
  async fetch(_request: Request, env: Env) {
    const cache = new CloudflareKVCache(env.KV_NAMESPACE)

    const model = new OpenAI({ cache });

    return new Response("OK")
  }
}
