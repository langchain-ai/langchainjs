import { OpenAIEmbeddings } from "@langchain/openai";
import { FilterExpressionBuilder } from "@langchain/core/filter";
import {
  DistanceStrategy,
  MariaDBStore,
} from "@langchain/community/vectorstores/mariadb";
import { PoolConfig } from "mariadb";

// First, follow set-up instructions at
// https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/mariadb

const config = {
  connectionOptions: {
    type: "mariadb",
    host: "127.0.0.1",
    port: 3306,
    user: "myuser",
    password: "ChangeMe",
    database: "api",
  } as PoolConfig,
  distanceStrategy: "EUCLIDEAN" as DistanceStrategy,
};

const vectorStore = await MariaDBStore.initialize(
  new OpenAIEmbeddings(),
  config
);

await vectorStore.addDocuments([
  {
    pageContent: "what's this",
    metadata: { country: "EN", year: 2021, city: "london" },
  },
  { pageContent: "Cat drinks milk", metadata: { country: "GE", year: 2020 } },
]);

const results = await vectorStore.similaritySearch("water", 1);

console.log(results);
// [ Document { pageContent: 'Cat drinks milk', metadata: { country: 'GE', year: 2020 }, id: ... } ]

// Filtering is supported
const b = new FilterExpressionBuilder();
let filter = b.gte("year", 2021); // year >= 2021
const results2 = await vectorStore.similaritySearch("water", 1, filter);
console.log(results2);
// [ Document { pageContent: 'what's this', metadata: { country: 'EN', year: 2021, city: 'london' } } ]

// more complex filter
filter = b.and(b.gte("year", 2021), b.in("country", ["US", "EN"])); // year >= 2021 AND country IN ['US, 'EN']
const results3 = await vectorStore.similaritySearch("water", 1, filter);
console.log(results3);
// [ Document { pageContent: 'what's this', metadata: { country: 'EN', year: 2021, city: 'london' }, id: ... } ]

await vectorStore.delete({ filter: b.gte("year", 2021) });

const results4 = await vectorStore.similaritySearch("water", 1);
console.log(results4);
// [   Document { pageContent: 'Cat drinks milk', metadata: { country: 'GE', year: 2020 }, id: ... } ]

// Filtering using array is supported
const results5 = await vectorStore.similaritySearch(
  "water",
  1,
  b.in("b", ["tag1"])
);

console.log(results5);
// [ ]

await vectorStore.end();
