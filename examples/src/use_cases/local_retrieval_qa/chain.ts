import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { Ollama } from "langchain/llms/ollama";
import { PromptTemplate } from "langchain/prompts";
import {
  RunnableSequence,
  RunnablePassthrough,
} from "langchain/schema/runnable";
import { StringOutputParser } from "langchain/schema/output_parser";
import { Document } from "langchain/document";
import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers";

const loader = new CheerioWebBaseLoader(
  "https://lilianweng.github.io/posts/2023-06-23-agent/"
);
const docs = await loader.load();

const splitter = new RecursiveCharacterTextSplitter({
  chunkOverlap: 0,
  chunkSize: 500,
});

const splitDocuments = await splitter.splitDocuments(docs);

const vectorstore = await HNSWLib.fromDocuments(
  splitDocuments,
  new HuggingFaceTransformersEmbeddings()
);

const retriever = vectorstore.asRetriever();

// Prompt
const prompt =
  PromptTemplate.fromTemplate(`Answer the question based only on the following context:
{context}

Question: {question}`);

// Llama 2 7b wrapped by Ollama
const model = new Ollama({
  baseUrl: "http://localhost:11434",
  model: "llama2",
});

const serializeDocs = (docs: Document[]) =>
  docs.map((doc) => doc.pageContent).join("\n");

const chain = RunnableSequence.from([
  {
    context: retriever.pipe(serializeDocs),
    question: new RunnablePassthrough(),
  },
  prompt,
  model,
  new StringOutputParser(),
]);

const result = await chain.invoke(
  "What are the approaches to Task Decomposition?"
);

console.log(result);

/*
  Based on the provided context, there are three approaches to task decomposition:

  1. Using simple prompts like "Steps for XYZ" or "What are the subgoals for achieving XYZ?" to elicit a list of tasks from a language model (LLM).
  2. Providing task-specific instructions, such as "Write a story outline" for writing a novel, to guide the LLM in decomposing the task into smaller subtasks.
  3. Incorporating human inputs to help the LLM learn and improve its decomposition abilities over time.
*/
