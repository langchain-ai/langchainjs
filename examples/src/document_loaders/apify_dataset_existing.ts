import { ApifyDatasetLoader } from "@langchain/community/document_loaders/web/apify_dataset";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";

const APIFY_API_TOKEN = "YOUR-APIFY-API-TOKEN"; // or set as process.env.APIFY_API_TOKEN
const OPENAI_API_KEY = "YOUR-OPENAI-API-KEY"; // or set as process.env.OPENAI_API_KEY

/*
 * datasetMappingFunction is a function that maps your Apify dataset format to LangChain documents.
 * In the below example, the Apify dataset format looks like this:
 * {
 *   "url": "https://apify.com",
 *   "text": "Apify is the best web scraping and automation platform."
 * }
 */
const loader = new ApifyDatasetLoader("your-dataset-id", {
  datasetMappingFunction: (item) =>
    new Document({
      pageContent: (item.text || "") as string,
      metadata: { source: item.url },
    }),
  clientOptions: {
    token: APIFY_API_TOKEN,
  },
});

const docs = await loader.load();

const vectorStore = await HNSWLib.fromDocuments(
  docs,
  new OpenAIEmbeddings({ apiKey: OPENAI_API_KEY })
);

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  apiKey: OPENAI_API_KEY,
});

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
  retriever: vectorStore.asRetriever(),
  combineDocsChain,
});

const res = await chain.invoke({ input: "What is LangChain?" });

console.log(res.answer);
console.log(res.context.map((doc) => doc.metadata.source));

/*
  LangChain is a framework for developing applications powered by language models.
  [
    'https://js.langchain.com/docs/',
    'https://js.langchain.com/docs/modules/chains/',
    'https://js.langchain.com/docs/modules/chains/llmchain/',
    'https://js.langchain.com/docs/category/functions-4'
  ]
*/
