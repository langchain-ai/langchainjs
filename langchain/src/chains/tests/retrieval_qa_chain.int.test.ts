import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { RetrievalQAChain } from "../retrieval_qa.js";

test("Test RetrievalQAChain from LLM with a text model", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const vectorStore = await HNSWLib.fromTexts(
    [
      "Mitochondria are the powerhouse of the cell",
      "Nuclei are the centers of a cell",
      "Your body contains many cells",
      "Cells are small rooms in prisons",
    ],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }],
    new OpenAIEmbeddings()
  );
  const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());
  const res = await chain.call({ query: "What is the powerhouse of a cell?" });
  console.log({ res });
});

test("Test RetrievalQAChain from LLM with a chat model and a prefix", async () => {
  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo" });
  const vectorStore = await HNSWLib.fromTexts(
    [
      "Mitochondria are the powerhouse of the cell",
      "Nuclei are the centers of a cell",
      "Your body contains many cells",
      "Cells are small rooms in prisons",
    ],
    [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }],
    new OpenAIEmbeddings()
  );
  const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
    prefix: `Be verbose, and output your answer like a pirate. Use plenty of args!`,
  });
  const res = await chain.call({ query: "What is the powerhouse of a cell?" });
  console.log({ res });
});
