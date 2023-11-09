import { ChatOpenAI } from "langchain/chat_models/openai";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChatPromptTemplate } from "langchain/prompts";
import { HumanMessage } from "langchain/schema";
import { StringOutputParser } from "langchain/schema/output_parser";
import { RunnableSequence } from "langchain/schema/runnable";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import fs from "node:fs/promises";

const model = new ChatOpenAI({
  modelName: "gpt-4-vision-preview",
  maxTokens: 1024,
}).pipe(new StringOutputParser());

// Load in images
const usNationalDebt = await fs.readFile(
  "./multi_modal_content/us_national_debt_chart.jpg"
);
const canadianNationalDebt = await fs.readFile(
  "./multi_modal_content/canadian_debt_by_gdp.jpg"
);
const mexicanNationalDebt = await fs.readFile(
  "./multi_modal_content/mexico_national_debt_monthly.jpg"
);

const images = {
  us: usNationalDebt,
  canada: canadianNationalDebt,
  mexico: mexicanNationalDebt,
};

const usDebtMessage = new HumanMessage({
  content: [
    {
      type: "text",
      text: "Describe the contents of this image in detail.",
    },
    {
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${images.us.toString("base64")}`,
      },
    },
  ],
});
const canadianDebtMessage = new HumanMessage({
  content: [
    {
      type: "text",
      text: "Describe the contents of this image in detail.",
    },
    {
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${images.canada.toString("base64")}`,
      },
    },
  ],
});
const mexicanDebtMessage = new HumanMessage({
  content: [
    {
      type: "text",
      text: "Describe the contents of this image in detail.",
    },
    {
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${images.mexico.toString("base64")}`,
      },
    },
  ],
});

const [usDebtResponse, canadianDebtResponse, mexicanDebtResponse] =
  await Promise.all([
    model.invoke([usDebtMessage]),
    model.invoke([canadianDebtMessage]),
    model.invoke([mexicanDebtMessage]),
  ]);

// create documents for each image.
const documents = [
  new Document({
    pageContent: usDebtResponse,
    metadata: {
      imageKey: "us",
    },
  }),
  new Document({
    pageContent: canadianDebtResponse,
    metadata: {
      imageKey: "canada",
    },
  }),
  new Document({
    pageContent: mexicanDebtResponse,
    metadata: {
      imageKey: "mexico",
    },
  }),
];
// init vector store
const vectorStore = await HNSWLib.fromDocuments(
  documents,
  new OpenAIEmbeddings()
);
const retriever = vectorStore.asRetriever();

// create the chain
// @TODO HumanMessage does not support input variables like this ATM.
const imageMessage = new HumanMessage({
  content: [
    {
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,{imageString}`,
      },
    },
  ],
});
const prompt = ChatPromptTemplate.fromMessages([
  ["ai", `Answer the users question using the provided image.`],
  ["human", "{question}"],
  imageMessage,
]);

const chain = RunnableSequence.from([
  async (input: string) => {
    const relevantDoc = (await retriever.getRelevantDocuments(input))[0];
    const imageKey = relevantDoc.metadata.imageKey as keyof typeof images;
    const imageString = images[imageKey].toString("base64");
    return {
      imageString,
      question: input,
    };
  },
  prompt,
  model,
]);
const response = await chain.invoke(
  "How much was Mexico's national debt increasing by on a monthly basis?"
);
console.log("response\n", response);
