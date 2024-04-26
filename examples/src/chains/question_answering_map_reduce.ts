import { OpenAI } from "@langchain/openai";
import { loadQAMapReduceChain } from "langchain/chains";
import { Document } from "@langchain/core/documents";

// Optionally limit the number of concurrent requests to the language model.
const model = new OpenAI({ temperature: 0, maxConcurrency: 10 });
const chain = loadQAMapReduceChain(model);
const docs = [
  new Document({ pageContent: "Harrison went to harvard" }),
  new Document({ pageContent: "Harrison obtained his degree in 2020" }),
  new Document({ pageContent: "Ankush went to princeton" }),
  new Document({ pageContent: "Ankush obtained his degree in 2019" }),
];
const res = await chain.invoke({
  input_documents: docs,
  question: "Where and when did Harrison obtain his degree?",
});

console.log(res);
/*
{
  text: 'Harrison obtained his degree at Harvard in 2020.'
}
*/
