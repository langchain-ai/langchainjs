import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";

export const run = async () => {
  const vectorStore = await MemoryVectorStore.fromTexts(
    [
      "Buildings are made out of brick",
      "Buildings are made out of wood",
      "Buildings are made out of stone",
      "Cars are made out of metal",
      "Cars are made out of plastic",
    ],
    [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
    new OpenAIEmbeddings()
  );

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0,
  });

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    // `1` is how many results in the first batch to fetch similar results. The `undefined` is the metadata filters
    vectorStore.asRetriever(1, undefined, {
      minSimilarityScore: 0.9, // Finds results with a similarity score of 90% or more
      dynamicK: true, // Uses a dynamic K value based on the minSimilarityScore. It'll keep increasing K until it can't find any more results
      maxK: 100, // The maximum K value to use. Use it based to your chunk size to make sure you don't run out of tokens
      kIncrement: 2, // How much to increase K by each time. It'll fetch N results, then N + kIncrement, then N + kIncrement * 2, etc.
    }),
    {
      returnSourceDocuments: true,
      memory: new BufferMemory({
        memoryKey: "chat_history",
        inputKey: "question",
        outputKey: "text",
      }),
    }
  );
  const res = await chain.call({
    question: "Buildings are made out of what?",
  });

  console.log("response:", res); // {"text":"Buildings can be made out of various materials such as wood, brick, or stone.","sourceDocuments":[{"pageContent":"Buildings are made out of wood","metadata":{"id":2}},{"pageContent":"Buildings are made out of brick","metadata":{"id":1}},{"pageContent":"Buildings are made out of stone","metadata":{"id":3}}]}
};
