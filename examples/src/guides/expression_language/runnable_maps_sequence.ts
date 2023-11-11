import { ChatAnthropic } from "langchain/chat_models/anthropic";
import { CohereEmbeddings } from "langchain/embeddings/cohere";
import { PromptTemplate } from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "langchain/schema/runnable";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import type { Document } from "langchain/document";

const model = new ChatAnthropic();
const vectorstore = await HNSWLib.fromDocuments(
  [{ pageContent: "mitochondria is the powerhouse of the cell", metadata: {} }],
  new CohereEmbeddings()
);
const retriever = vectorstore.asRetriever();
const template = `Answer the question based only on the following context:
{context}

Question: {question}`;

const prompt = PromptTemplate.fromTemplate(template);

const formatDocs = (docs: Document[]) => docs.map((doc) => doc.pageContent);

const retrievalChain = RunnableSequence.from([
  { context: retriever.pipe(formatDocs), question: new RunnablePassthrough() },
  prompt,
  model,
  new StringOutputParser(),
]);

const result = await retrievalChain.invoke(
  "what is the powerhouse of the cell?"
);
console.log(result);

/*
 Based on the given context, the powerhouse of the cell is mitochondria.
*/
