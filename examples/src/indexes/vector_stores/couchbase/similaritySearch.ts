import { OpenAIEmbeddings } from "@langchain/openai";
import {
  CouchbaseVectorStoreArgs,
  CouchbaseVectorStore,
} from "@langchain/community/vectorstores/couchbase";
import { Cluster } from "couchbase";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { CharacterTextSplitter } from "langchain/text_splitter";

const connectionString =
  process.env.COUCHBASE_DB_CONN_STR ?? "couchbase://localhost";
const databaseUsername = process.env.COUCHBASE_DB_USERNAME ?? "Administrator";
const databasePassword = process.env.COUCHBASE_DB_PASSWORD ?? "Password";

// Load documents from file
const loader = new TextLoader("./state_of_the_union.txt");
const rawDocuments = await loader.load();
const splitter = new CharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 0,
});
const docs = await splitter.splitDocuments(rawDocuments);

const couchbaseClient = await Cluster.connect(connectionString, {
  username: databaseUsername,
  password: databasePassword,
  configProfile: "wanDevelopment",
});

// Open AI API Key is required to use OpenAIEmbeddings, some other embeddings may also be used
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
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
