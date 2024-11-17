import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings, OpenAI } from "@langchain/openai";
import { SelfQueryRetriever } from "langchain/retrievers/self_query";
import { PineconeStore, PineconeTranslator } from "@langchain/pinecone";
import { Document } from "@langchain/core/documents";
import type { AttributeInfo } from "langchain/chains/query_constructor";

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
 * We also need to provide an embeddings object. This is used to embed the documents.
 */
if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
  throw new Error("PINECONE_API_KEY and PINECONE_INDEX must be set");
}

const pinecone = new Pinecone();

const index = pinecone.Index(process.env.PINECONE_INDEX);

const embeddings = new OpenAIEmbeddings();
const llm = new OpenAI();
const documentContents = "Brief summary of a movie";
const vectorStore = await PineconeStore.fromDocuments(docs, embeddings, {
  pineconeIndex: index,
});
const selfQueryRetriever = SelfQueryRetriever.fromLLM({
  llm,
  vectorStore,
  documentContents,
  attributeInfo,
  /**
   * We need to create a basic translator that translates the queries into a
   * filter format that the vector store can understand. We provide a basic translator
   * translator here, but you can create your own translator by extending BaseTranslator
   * abstract class. Note that the vector store needs to support filtering on the metadata
   * attributes you want to query on.
   */
  structuredQueryTranslator: new PineconeTranslator(),
});

/**
 * Now we can query the vector store.
 * We can ask questions like "Which movies are less than 90 minutes?" or "Which movies are rated higher than 8.5?".
 * We can also ask questions like "Which movies are either comedy or drama and are less than 90 minutes?".
 * The retriever will automatically convert these questions into queries that can be used to retrieve documents.
 */
const query1 = await selfQueryRetriever.invoke(
  "Which movies are less than 90 minutes?"
);
const query2 = await selfQueryRetriever.invoke(
  "Which movies are rated higher than 8.5?"
);
const query3 = await selfQueryRetriever.invoke(
  "Which movies are directed by Greta Gerwig?"
);
const query4 = await selfQueryRetriever.invoke(
  "Which movies are either comedy or drama and are less than 90 minutes?"
);
console.log(query1, query2, query3, query4);
