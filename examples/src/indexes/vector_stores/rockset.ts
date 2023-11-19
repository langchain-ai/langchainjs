import * as rockset from "@rockset/client";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { RetrievalQAChain } from "langchain/chains";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RocksetStore } from "langchain/vectorstores/rockset";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { readFileSync } from "fs";

export const run = async () => {
  const store = await RocksetStore.withNewCollection(new OpenAIEmbeddings(), {
    client: rockset.default.default(
      process.env.ROCKSET_API_KEY ?? "",
      `https://api.${process.env.ROCKSET_API_REGION ?? "usw2a1"}.rockset.com`
    ),
    collectionName: "langchain_demo",
  });

  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo" });
  const chain = RetrievalQAChain.fromLLM(model, store.asRetriever());
  const text = readFileSync("state_of_the_union.txt", "utf8");
  const docs = await new RecursiveCharacterTextSplitter().createDocuments([
    text,
  ]);

  await store.addDocuments(docs);
  const response = await chain.call({
    query: "What is America's role in Ukraine?",
  });
  console.log(response.text);
  await store.destroy();
};
