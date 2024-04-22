import { createTaggingChain } from "langchain/chains";
import { ChatOpenAI } from "@langchain/openai";
import type { FunctionParameters } from "langchain/output_parsers";

const schema: FunctionParameters = {
  type: "object",
  properties: {
    sentiment: { type: "string" },
    tone: { type: "string" },
    language: { type: "string" },
  },
  required: ["tone"],
};

const chatModel = new ChatOpenAI({ model: "gpt-4-0613", temperature: 0 });

const chain = createTaggingChain(schema, chatModel);

console.log(
  await chain.run(
    `Estoy increiblemente contento de haberte conocido! Creo que seremos muy buenos amigos!`
  )
);
/*
{ tone: 'positive', language: 'Spanish' }
*/
