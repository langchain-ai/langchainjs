import * as rockset from "@rockset/client";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RocksetStore } from "@langchain/community/vectorstores/rockset";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { readFileSync } from "fs";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";

const store = await RocksetStore.withNewCollection(new OpenAIEmbeddings(), {
  client: rockset.default.default(
    process.env.ROCKSET_API_KEY ?? "",
    `https://api.${process.env.ROCKSET_API_REGION ?? "usw2a1"}.rockset.com`
  ),
  collectionName: "langchain_demo",
});

const model = new ChatOpenAI({ model: "gpt-3.5-turbo-1106" });
const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Answer the user's questions based on the below context:\n\n{context}",
  ],
  ["human", "{input}"],
]);

const combineDocsChain = await createStuffDocumentsChain({
  llm: model,
  prompt: questionAnsweringPrompt,
});

const chain = await createRetrievalChain({
  retriever: store.asRetriever(),
  combineDocsChain,
});

const text = readFileSync("state_of_the_union.txt", "utf8");
const docs = await new RecursiveCharacterTextSplitter().createDocuments([text]);

await store.addDocuments(docs);
const response = await chain.invoke({
  input: "When was America founded?",
});
console.log(response.answer);
await store.destroy();
