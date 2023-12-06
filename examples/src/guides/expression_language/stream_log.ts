import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChatPromptTemplate } from "langchain/prompts";
import { RunnableSequence } from "langchain/runnables";
import { HNSWLib } from "langchain/vectorstores/hnswlib";

const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "You are a helpful assistant.\nContext: {context}"],
  ["human", "{question}"],
]);
const model = new ChatOpenAI({});

const vectorStore = await HNSWLib.fromDocuments(
  [
    {
      pageContent: "Harrison worked at kensho",
      metadata: {},
    },
  ],
  new OpenAIEmbeddings()
);

const retriever = vectorStore.asRetriever();

const runnable = RunnableSequence.from([
  {
    question: (i) => i.question,
    context: async (i) => {
      const relevantDocs = await retriever.getRelevantDocuments(i.question);
      return relevantDocs[0].pageContent;
    },
  },
  prompt,
  model,
]);

const streamLog = runnable.streamLog(
  {
    question: "where did harrison work?",
  },
  undefined,
  {
    includeNames: ["Docs"],
  }
);

for await (const log of streamLog) {
  console.log("----------------------------------------");
  console.log(log.ops[0]);
}
/**
----------------------------------------
[{ op: 'replace', path: '', value: { id: '8f1be3af-d51f-48b9-805d-239385f3514c', streamed_output: [] }}]
----------------------------------------
[{ op: 'add', path: '/streamed_output/-', value: AIMessageChunk { content: '', additional_kwargs: {} }}]
----------------------------------------
[{ op: 'add', path: '/streamed_output/-', value: AIMessageChunk { content: 'H', additional_kwargs: {} }}]
----------------------------------------
[{ op: 'add', path: '/streamed_output/-', value: AIMessageChunk { content: 'arrison', additional_kwargs: {} }}]
----------------------------------------
[{ op: 'add', path: '/streamed_output/-', value: AIMessageChunk { content: ' worked', additional_kwargs: {} }}]
----------------------------------------
[{ op: 'add', path: '/streamed_output/-', value: AIMessageChunk { content: ' at', additional_kwargs: {} }}]
----------------------------------------
[{ op: 'add', path: '/streamed_output/-', value: AIMessageChunk { content: ' Kens', additional_kwargs: {} }}]
----------------------------------------
[{ op: 'add', path: '/streamed_output/-', value: AIMessageChunk { content: 'ho', additional_kwargs: {} }}]
----------------------------------------
[{ op: 'add', path: '/streamed_output/-', value: AIMessageChunk { content: '.', additional_kwargs: {} }}]
----------------------------------------
[{ op: 'add', path: '/streamed_output/-', value: AIMessageChunk { content: '', additional_kwargs: {} }}]
----------------------------------------
[{ op: 'replace', path: '/final_output', value: AIMessageChunk { content: 'Harrison worked at Kensho.', additional_kwargs: {} }}]
 */
