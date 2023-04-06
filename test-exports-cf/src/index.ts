/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";
import { OpenAI } from "langchain/llms";
import { OpenAIEmbeddings } from "langchain/embeddings";
import { PineconeStore } from "langchain/vectorstores";
import { TextLoader } from "langchain/document_loaders";

export interface Env {
  OPENAI_API_KEY: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    console.log("Hello, world!");
    console.log(PineconeStore);
    console.log(OpenAI);
    console.log(OpenAIEmbeddings);
    console.log(TextLoader);
    console.log(LLMChain);
    console.log(ChatOpenAI);
    console.log(ChatPromptTemplate);
    console.log(HumanMessagePromptTemplate);

    // Intantiate a few things to test the exports
    new OpenAI({ openAIApiKey: env.OPENAI_API_KEY });
    const emb = new OpenAIEmbeddings({ openAIApiKey: env.OPENAI_API_KEY });

    // Test a document loader from a blob
    const docs = new TextLoader(new Blob(["hello"]));

    const chain = new LLMChain({
      llm: new ChatOpenAI({ openAIApiKey: env.OPENAI_API_KEY }),
      prompt: ChatPromptTemplate.fromPromptMessages([
        HumanMessagePromptTemplate.fromTemplate("{input}"),
      ]),
    });
    const res = await chain.run("hello");
    return new Response(`Hello, from ${request.url}. Assistant says: ${res}`);
  },
};
