import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { formatDocumentsAsString } from "langchain/util/document";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});

const vectorStore = await HNSWLib.fromTexts(
  ["mitochondria is the powerhouse of the cell"],
  [{ id: 1 }],
  new OpenAIEmbeddings()
);
const retriever = vectorStore.asRetriever();

const languagePrompt =
  PromptTemplate.fromTemplate(`Answer the question based only on the following context:
{context}

Question: {question}

Answer in the following language: {language}`);

type LanguageChainInput = {
  question: string;
  language: string;
};

const languageChain = RunnableSequence.from([
  {
    // Every property in the map receives the same input,
    // so we need to extract just the standalone question to pass into the retriever.
    // We then serialize the retrieved docs into a string to pass into the prompt.
    context: RunnableSequence.from([
      (input: LanguageChainInput) => input.question,
      retriever,
      formatDocumentsAsString,
    ]),
    question: (input: LanguageChainInput) => input.question,
    language: (input: LanguageChainInput) => input.language,
  },
  languagePrompt,
  model,
  new StringOutputParser(),
]);

const result = await languageChain.invoke({
  question: "What is the powerhouse of the cell?",
  language: "German",
});

console.log(result);

/*
  "Mitochondrien sind das Kraftwerk der Zelle."
*/
