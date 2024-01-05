import { AnalyticDBVectorStore } from "@langchain/community/vectorstores/analyticdb";
import { OpenAIEmbeddings } from "@langchain/openai";

const connectionOptions = {
  host: process.env.ANALYTICDB_HOST || "localhost",
  port: Number(process.env.ANALYTICDB_PORT) || 5432,
  database: process.env.ANALYTICDB_DATABASE || "your_database",
  user: process.env.ANALYTICDB_USERNAME || "username",
  password: process.env.ANALYTICDB_PASSWORD || "password",
};

const vectorStore = await AnalyticDBVectorStore.fromTexts(
  ["foo", "bar", "baz"],
  [{ page: 1 }, { page: 2 }, { page: 3 }],
  new OpenAIEmbeddings(),
  { connectionOptions }
);
const result = await vectorStore.similaritySearch("foo", 1);
console.log(JSON.stringify(result));
// [{"pageContent":"foo","metadata":{"page":1}}]

await vectorStore.addDocuments([{ pageContent: "foo", metadata: { page: 4 } }]);

const filterResult = await vectorStore.similaritySearch("foo", 1, {
  page: 4,
});
console.log(JSON.stringify(filterResult));
// [{"pageContent":"foo","metadata":{"page":4}}]

const filterWithScoreResult = await vectorStore.similaritySearchWithScore(
  "foo",
  1,
  { page: 3 }
);
console.log(JSON.stringify(filterWithScoreResult));
// [[{"pageContent":"baz","metadata":{"page":3}},0.26075905561447144]]

const filterNoMatchResult = await vectorStore.similaritySearchWithScore(
  "foo",
  1,
  { page: 5 }
);
console.log(JSON.stringify(filterNoMatchResult));
// []

// need to manually close the Connection pool
await vectorStore.end();
