/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// import all entrypoints
import * as agents from "langchain/agents";
import * as base_language from "langchain/base_language";
import * as tools from "langchain/tools";
import * as chains from "langchain/chains";
import * as embeddings from "langchain/embeddings";
import * as llms from "langchain/llms";
import * as prompts from "langchain/prompts";
import * as vectorstores from "langchain/vectorstores";
import * as text_splitter from "langchain/text_splitter";
import * as memory from "langchain/memory";
import * as document from "langchain/document";
import * as docstore from "langchain/docstore";
import * as document_loaders from "langchain/document_loaders";
import * as chat_models from "langchain/chat_models";
import * as schema from "langchain/schema";
import * as sql_db from "langchain/sql_db";
import * as callbacks from "langchain/callbacks";
import * as output_parsers from "langchain/output_parsers";
import * as retrievers from "langchain/retrievers";

// Import a few things we'll use to test the exports
import { LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";
import { OpenAI } from "langchain/llms";
import { OpenAIEmbeddings } from "langchain/embeddings";
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
    // Intantiate a few things to test the exports
    new OpenAI({ openAIApiKey: env.OPENAI_API_KEY });
    const emb = new OpenAIEmbeddings({ openAIApiKey: env.OPENAI_API_KEY });

    // Test a document loader from a blob
    const docs = new TextLoader(new Blob(["hello"]));

    // Test a chain + prompt + model
    const chain = new LLMChain({
      llm: new ChatOpenAI({ openAIApiKey: env.OPENAI_API_KEY }),
      prompt: ChatPromptTemplate.fromPromptMessages([
        HumanMessagePromptTemplate.fromTemplate("{input}"),
      ]),
    });
    const res = await chain.run("hello");

    return new Response(
      `Hello, from Cloudflare Worker at ${request.url}. Assistant says: ${res}`
    );
  },
};
