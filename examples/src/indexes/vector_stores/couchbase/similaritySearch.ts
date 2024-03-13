import { OpenAIEmbeddings } from "@langchain/openai";
import {
  CouchbaseVectorStoreArgs,
  CouchbaseVectorStore,
} from "@langchain/community/vectorstores/couchbase";
import { Cluster } from "couchbase";
import { readFileSync } from "fs";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const connectionString = process.env.DB_CONN_STR ?? "couchbase://localhost";
const databaseUsername = process.env.DB_USERNAME ?? "Administrator";
const databasePassword = process.env.DB_PASSWORD ?? "Password";

const text = readFileSync("state_of_the_union.txt", "utf8");
const docs = await new RecursiveCharacterTextSplitter().createDocuments([text]);

const couchbaseClient = await Cluster.connect(connectionString, {
  username: databaseUsername,
  password: databasePassword,
  configProfile: "wanDevelopment",
});

// Open AI API Key is required to use OpenAIEmbeddings, some other embeddings may also be used
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const couchbaseConfig: CouchbaseVectorStoreArgs = {
  cluster: couchbaseClient,
  bucketName: "testing",
  scopeName: "_default",
  collectionName: "_default",
  indexName: "vector-index",
  textKey: "text",
  embeddingKey: "embedding",
};

const store = await CouchbaseVectorStore.fromDocuments(
  docs,
  embeddings,
  couchbaseConfig
);

const query = "What did president say about Ketanji Brown Jackson";

const resultsSimilaritySearch = await store.similaritySearch(query);
console.log("resulting documents: ", resultsSimilaritySearch[0]);

// Similarity Search With Score
const resultsSimilaritySearchWithScore = await store.similaritySearchWithScore(
  query,
  1
);
console.log("resulting documents: ", resultsSimilaritySearchWithScore[0][0]);
console.log("resulting scores: ", resultsSimilaritySearchWithScore[0][1]);

const result = await store.similaritySearch(query, 1, {
  fields: ["metadata.source"],
});
console.log(result[0]);
