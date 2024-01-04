import { ChatOpenAI } from "langchain/chat_models/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda } from "@langchain/core/runnables";
import { RunnableMap } from "@langchain/core/runnables";
import { RunnablePassthrough } from "@langchain/core/runnables";

const vectorStore = await HNSWLib.fromDocuments(
  [
    new Document({ pageContent: "Harrison worked at Kensho" }),
    new Document({ pageContent: "Bears like to eat honey." })
  ],
  new OpenAIEmbeddings()
);
const retriever = vectorStore.asRetriever(1);

const prompt = ChatPromptTemplate.fromMessages([
  [
    "ai",
    `Answer the question based on only the following context:
  
{context}`
  ],
  ["human", "{question}"]
]);
const model = new ChatOpenAI({});
const outputParser = new StringOutputParser();

const setupAndRetrieval = RunnableMap.from({
  context: new RunnableLambda({
    func: (input: string) =>
      retriever.invoke(input).then((response) => response[0].pageContent)
  }).withConfig({ runName: "contextRetriever" }),
  question: new RunnablePassthrough()
});
const chain = setupAndRetrieval.pipe(prompt).pipe(model).pipe(outputParser);

const response = await chain.invoke("Where did Harrison work?");
console.log(response);
/**
Harrison worked at Kensho.
 */
