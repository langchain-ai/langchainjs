import weaviate from "weaviate-client";

import { OpenAIEmbeddings, OpenAI } from "@langchain/openai";
import { SelfQueryRetriever } from "langchain/retrievers/self_query";
import { WeaviateStore, WeaviateTranslator } from "@langchain/weaviate";
import { Document } from "@langchain/core/documents";
import { AttributeInfo } from "langchain/chains/query_constructor";

/**
 * First, we create a bunch of documents. You can load your own documents here instead.
 * Each document has a pageContent and a metadata field. Make sure your metadata matches the AttributeInfo below.
 */
const docs = [
  new Document({
    pageContent:
      "A bunch of scientists bring back dinosaurs and mayhem breaks loose",
    metadata: { year: 1993, rating: 7.7, genre: "science fiction" },
  }),
  new Document({
    pageContent:
      "Leo DiCaprio gets lost in a dream within a dream within a dream within a ...",
    metadata: { year: 2010, director: "Christopher Nolan", rating: 8.2 },
  }),
  new Document({
    pageContent:
      "A psychologist / detective gets lost in a series of dreams within dreams within dreams and Inception reused the idea",
    metadata: { year: 2006, director: "Satoshi Kon", rating: 8.6 },
  }),
  new Document({
    pageContent:
      "A bunch of normal-sized women are supremely wholesome and some men pine after them",
    metadata: { year: 2019, director: "Greta Gerwig", rating: 8.3 },
  }),
  new Document({
    pageContent: "Toys come alive and have a blast doing so",
    metadata: { year: 1995, genre: "animated" },
  }),
  new Document({
    pageContent: "Three men walk into the Zone, three men walk out of the Zone",
    metadata: {
      year: 1979,
      director: "Andrei Tarkovsky",
      genre: "science fiction",
      rating: 9.9,
    },
  }),
];

/**
 * Next, we define the attributes we want to be able to query on.
 * in this case, we want to be able to query on the genre, year, director, rating, and length of the movie.
 * We also provide a description of each attribute and the type of the attribute.
 * This is used to generate the query prompts.
 */
const attributeInfo: AttributeInfo[] = [
  {
    name: "genre",
    description: "The genre of the movie",
    type: "string or array of strings",
  },
  {
    name: "year",
    description: "The year the movie was released",
    type: "number",
  },
  {
    name: "director",
    description: "The director of the movie",
    type: "string",
  },
  {
    name: "rating",
    description: "The rating of the movie (1-10)",
    type: "number",
  },
  {
    name: "length",
    description: "The length of the movie in minutes",
    type: "number",
  },
];

/**
 * Next, we instantiate a vector store. This is where we store the embeddings of the documents.
 */
const embeddings = new OpenAIEmbeddings();
const llm = new OpenAI();
const documentContents = "Brief summary of a movie";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = (weaviate as any).client({
  scheme: process.env.WEAVIATE_SCHEME || "https",
  host: process.env.WEAVIATE_HOST || "localhost",
  apiKey: process.env.WEAVIATE_API_KEY
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new (weaviate as any).ApiKey(process.env.WEAVIATE_API_KEY)
    : undefined,
});

const vectorStore = await WeaviateStore.fromDocuments(docs, embeddings, {
  client,
  indexName: "Test",
  textKey: "text",
  metadataKeys: ["year", "director", "rating", "genre"],
});
const selfQueryRetriever = SelfQueryRetriever.fromLLM({
  llm,
  vectorStore,
  documentContents,
  attributeInfo,
  /**
   * We need to use a translator that translates the queries into a
   * filter format that the vector store can understand. LangChain provides one here.
   */
  structuredQueryTranslator: new WeaviateTranslator<WeaviateStore>(),
});

/**
 * Now we can query the vector store.
 * We can ask questions like "Which movies are less than 90 minutes?" or "Which movies are rated higher than 8.5?".
 * We can also ask questions like "Which movies are either comedy or drama and are less than 90 minutes?".
 * The retriever will automatically convert these questions into queries that can be used to retrieve documents.
 *
 * Note that unlike other vector stores, you have to make sure each metadata keys are actually presnt in the database,
 * meaning that Weaviate will throw an error if the self query chain generate a query with a metadata key that does
 * not exist in your Weaviate database.
 */
const query1 = await selfQueryRetriever.invoke(
  "Which movies are rated higher than 8.5?"
);
const query2 = await selfQueryRetriever.invoke(
  "Which movies are directed by Greta Gerwig?"
);
console.log(query1, query2);
