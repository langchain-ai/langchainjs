import { OpenAI } from "@langchain/openai";
import { VercelKVCache } from "@langchain/community/caches/vercel_kv";
import { createClient } from "@vercel/kv";

// See https://vercel.com/docs/storage/vercel-kv/kv-reference#createclient-example for connection options
const cache = new VercelKVCache({
  client: createClient({
    url: "VERCEL_KV_API_URL",
    token: "VERCEL_KV_API_TOKEN",
  }),
  ttl: 3600,
});

const model = new OpenAI({ cache });
