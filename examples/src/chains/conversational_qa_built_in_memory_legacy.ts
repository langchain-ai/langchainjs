import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { BufferMemory } from "langchain/memory";

import * as fs from "fs";

export const run = async () => {
  const text = fs.readFileSync("state_of_the_union.txt", "utf8");
  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  const docs = await textSplitter.createDocuments([text]);
  const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
  const fasterModel = new ChatOpenAI({
    model: "gpt-3.5-turbo",
  });
  const slowerModel = new ChatOpenAI({
    model: "gpt-4",
  });
  const chain = ConversationalRetrievalQAChain.fromLLM(
    slowerModel,
    vectorStore.asRetriever(),
    {
      returnSourceDocuments: true,
      memory: new BufferMemory({
        memoryKey: "chat_history",
        inputKey: "question", // The key for the input to the chain
        outputKey: "text", // The key for the final conversational output of the chain
        returnMessages: true, // If using with a chat model (e.g. gpt-3.5 or gpt-4)
      }),
      questionGeneratorChainOptions: {
        llm: fasterModel,
      },
    }
  );
  /* Ask it a question */
  const question = "What did the president say about Justice Breyer?";
  const res = await chain.invoke({ question });
  console.log(res);

  const followUpRes = await chain.invoke({ question: "Was that nice?" });
  console.log(followUpRes);
};
