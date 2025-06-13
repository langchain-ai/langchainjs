/* eslint-disable no-process-env */
import { expect, test } from "@jest/globals";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { ConversationalRetrievalQAChain } from "../../chains/conversational_retrieval_chain.js";
import { BufferMemory } from "../../memory/buffer_memory.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";
import { ScoreThresholdRetriever } from "../score_threshold.js";

test("ConversationalRetrievalQAChain.fromLLM should use its vector store recursively until it gets all the similar results with the minimum similarity score provided", async () => {
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
    model: "gpt-3.5-turbo",
    temperature: 0,
  });

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    ScoreThresholdRetriever.fromVectorStore(vectorStore, {
      minSimilarityScore: 0.9,
      kIncrement: 1,
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
  const res = await chain.invoke({
    question: "Buildings are made out of what?",
  });

  // console.log("response:", res);

  expect(res).toEqual(
    expect.objectContaining({
      text: expect.any(String),
      sourceDocuments: expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({
            id: 1,
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            id: 2,
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            id: 3,
          }),
        }),
      ]),
    })
  );
});

test("ConversationalRetrievalQAChain.fromLLM should use its vector store to get up to X results that matches the provided similarity score", async () => {
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
    model: "gpt-3.5-turbo",
    temperature: 0,
  });

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    ScoreThresholdRetriever.fromVectorStore(vectorStore, {
      minSimilarityScore: 0.9,
      maxK: 2,
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

  expect(res.sourceDocuments).toHaveLength(2);
});
