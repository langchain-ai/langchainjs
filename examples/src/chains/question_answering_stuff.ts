import { OpenAI } from "@langchain/openai";
import { loadQAStuffChain } from "langchain/chains";
import { Document } from "@langchain/core/documents";

// This first example uses the `StuffDocumentsChain`.
const llmA = new OpenAI({});
const chainA = loadQAStuffChain(llmA);
const docs = [
  new Document({ pageContent: "Harrison went to Harvard." }),
  new Document({ pageContent: "Ankush went to Princeton." }),
];
const resA = await chainA.invoke({
  input_documents: docs,
  question: "Where did Harrison go to college?",
});
console.log({ resA });
// { resA: { text: ' Harrison went to Harvard.' } }
