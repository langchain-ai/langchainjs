import { ChatOpenAI } from "langchain/chat_models/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PromptTemplate } from "langchain/prompts";
import { RunnableSequence } from "langchain/schema/runnable";
import { StringOutputParser } from "langchain/schema/output_parser";
import { Document } from "langchain/document";

const model = new ChatOpenAI({});

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

const serializeDocs = (docs: Document[]) =>
  docs.map((doc) => doc.pageContent).join("\n");

const languageChain = RunnableSequence.from([
  {
    question: (input: LanguageChainInput) => input.question,
    language: (input: LanguageChainInput) => input.language,
    context: (input: LanguageChainInput) =>
      retriever.pipe(serializeDocs).invoke(input.question),
  },
  languagePrompt,
  model,
  new StringOutputParser(),
]);

const result2 = await languageChain.invoke({
  question: "What is the powerhouse of the cell?",
  language: "German",
});

console.log(result2);

/*
  "Mitochondrien sind das Kraftwerk der Zelle."
*/
