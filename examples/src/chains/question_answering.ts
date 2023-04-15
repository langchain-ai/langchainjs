import { OpenAI } from "langchain/llms/openai";
import { loadQAStuffChain, loadQAMapReduceChain } from "langchain/chains";
import { Document } from "langchain/document";

export const run = async () => {
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

  // This second example uses the `MapReduceChain`.
  // Optionally limit the number of concurrent requests to the language model.
  const llmB = new OpenAI({ maxConcurrency: 10 });
  const chainB = loadQAMapReduceChain(llmB);
  const resB = await chainB.call({
    input_documents: docs,
    question: "Where did Harrison go to college?",
  });
  console.log({ resB });
  // { resB: { text: ' Harrison went to Harvard.' } }
};
