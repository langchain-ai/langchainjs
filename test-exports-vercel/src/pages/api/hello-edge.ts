// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

// import all entrypoints
import "../../entrypoints.js";

// Import a few things we'll use to test the exports
import { LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";
import { OpenAI } from "langchain/llms/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

import { NextRequest, NextResponse } from "next/server";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest) {
  // Intantiate a few things to test the exports
  new OpenAI({ openAIApiKey: process.env.OPENAI_API_KEY });
  const emb = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  // Test a chain + prompt + model
  const chain = new LLMChain({
    llm: new ChatOpenAI({ openAIApiKey: process.env.OPENAI_API_KEY }),
    prompt: ChatPromptTemplate.fromPromptMessages([
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]),
  });
  const res = await chain.run("hello");

  return NextResponse.json({
    name: `Hello, from ${req.url} I'm an Edge Function! Assistant says: ${res}`,
  });
}
