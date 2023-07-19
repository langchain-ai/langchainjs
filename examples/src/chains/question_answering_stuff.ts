import { OpenAI } from "langchain/llms/openai";
import { loadQAStuffChain } from "langchain/chains";
import { Document } from "langchain/document";

// This first example uses the `StuffDocumentsChain`.
const llmA = new OpenAI({});
const chainA = loadQAStuffChain(llmA);
const docs = [
  new Document({ pageContent: "Harrison went to Harvard." }),
  new Document({ pageContent: "Ankush went to Princeton." }),
];
const resA = await chainA.call({
  input_documents: docs,
  question: "Where did Harrison go to college?",
});
console.log({ resA });
// { resA: { text: ' Harrison went to Harvard.' } }
