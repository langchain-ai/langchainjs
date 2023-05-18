/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// import all entrypoints to test, do not do this in your own app
import "./entrypoints.js";

// Import a few things we'll use to test the exports
import { LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";
import { OpenAI } from "langchain/llms/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { HNLoader } from "langchain/document_loaders/web/hn";

export interface Env {
  OPENAI_API_KEY?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_OPENAI_API_INSTANCE_NAME?: string;
  AZURE_OPENAI_API_DEPLOYMENT_NAME?: string;
  AZURE_OPENAI_API_VERSION?: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {

    const constructorParameters
      = env.AZURE_OPENAI_API_KEY ? {
        azureOpenAIApiKey: env.AZURE_OPENAI_API_KEY,
        azureOpenAIApiInstanceName: env.AZURE_OPENAI_API_INSTANCE_NAME,
        azureOpenAIApiDeploymentName: env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
        azureOpenAIApiVersion: env.AZURE_OPENAI_API_VERSION,
      } 
      : {
        openAIApiKey: env.OPENAI_API_KEY,
      }

    // Intantiate a few things to test the exports
    new OpenAI(constructorParameters);
    const emb = new OpenAIEmbeddings(constructorParameters);

    // Test a document loader
    new HNLoader("https://news.ycombinator.com/item?id=28275939");

    // Test a chain + prompt + model
    const chain = new LLMChain({
      llm: new ChatOpenAI(constructorParameters),
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
