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

// Import the TensorFlow backend.
import "@tensorflow/tfjs-node";
import { TensorFlowEmbeddings } from "langchain/embeddings/tensorflow";

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
  new TensorFlowEmbeddings()
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
  Thank you for providing the context! Based on the information provided, there are three approaches to task decomposition:

  1. Simple Prompting: This approach involves providing LLMs with simple prompts like "Steps for XYZ" or "What are the subgoals for achieving XYZ?" The LLM can then generate the steps required to complete the task based on its training data.
  2. Task-Specific Instructions: This approach involves providing LLMs with specific instructions for completing a particular task, such as "Write a story outline" or "Solve this math problem." The LLM will then use its language generation capabilities to produce the required steps for completing the task.
  3. Human Inputs: This approach involves using human inputs to guide the task decomposition process. For example, a human can provide a list of tasks that need to be completed and the LLM can then generate the subtasks or steps required to complete each task.

  I hope this helps! Let me know if you have any further questions.
*/
