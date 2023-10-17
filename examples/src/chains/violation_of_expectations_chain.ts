import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";

// Instantiate with an empty array to start, since we have no data yet.
const vectorStore = await HNSWLib.fromTexts([], [], new OpenAIEmbeddings());
const retriever = vectorStore.asRetriever();

// Instantiate the LLM,
const llm = new ChatOpenAI({
  modelName: "gpt-4",
});

// const voeChain = ViolationOfExpectationsChain.fromLLM({
//   llm,
//   retriever,
// });

// // Requires an input key of "chat_history" with an array of messages.
// const result = voeChain.call({
//   chat_history: dummyMessages,
// });
