import { CohereEmbeddings } from "@langchain/cohere";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";
import { ChatAnthropic } from "@langchain/anthropic";

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
