// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

// import all entrypoints to test, do not do this in your own app
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
import { TextLoader } from "langchain/document_loaders/fs/text";

import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Intantiate a few things to test the exports
  new OpenAI({ openAIApiKey: process.env.OPENAI_API_KEY });
  const emb = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  // Test a document loader from a blob
  const docs = new TextLoader(new Blob(["hello"]));

  // Test a chain + prompt + model
  const chain = new LLMChain({
    llm: new ChatOpenAI({ openAIApiKey: process.env.OPENAI_API_KEY }),
    prompt: ChatPromptTemplate.fromMessages([
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]),
  });
  const output = await chain.run("hello");

  return res.status(200).json({
    name: `Hello, from ${req.url} I'm a Serverless Function! Assistant says: ${output}`,
  });
}
