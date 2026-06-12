// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

// import all entrypoints to test, do not do this in your own app
import "../../entrypoints.js";

// Import a few things we'll use to test the exports
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";
import { OpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";

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

  // Test a chain + prompt + model using LCEL
  const prompt = ChatPromptTemplate.fromMessages([
    HumanMessagePromptTemplate.fromTemplate("{input}"),
  ]);
  const chain = prompt.pipe(
    new ChatOpenAI({ openAIApiKey: process.env.OPENAI_API_KEY })
  );
  const output = await chain.invoke({ input: "hello" });

  return res.status(200).json({
    name: `Hello, from ${req.url} I'm a Serverless Function! Assistant says: ${output}`,
  });
}
