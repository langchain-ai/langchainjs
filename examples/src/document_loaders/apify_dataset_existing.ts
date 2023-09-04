import { ApifyDatasetLoader } from "langchain/document_loaders/web/apify_dataset";
import { Document } from "langchain/document";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RetrievalQAChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";

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
    token: "your-apify-token", // Or set as process.env.APIFY_API_TOKEN
  },
});

const docs = await loader.load();

const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());

const model = new OpenAI({
  temperature: 0,
});

const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever(), {
  returnSourceDocuments: true,
});
const res = await chain.call({ query: "What is LangChain?" });

console.log(res.text);
console.log(res.sourceDocuments.map((d: Document) => d.metadata.source));

/*
  LangChain is a framework for developing applications powered by language models.
  [
    'https://js.langchain.com/docs/',
    'https://js.langchain.com/docs/modules/chains/',
    'https://js.langchain.com/docs/modules/chains/llmchain/',
    'https://js.langchain.com/docs/category/functions-4'
  ]
*/
