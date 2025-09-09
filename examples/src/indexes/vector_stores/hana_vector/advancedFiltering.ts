import { OpenAIEmbeddings } from "@langchain/openai";
import hanaClient from "hdb";
import { Document } from "@langchain/core/documents";
import {
  HanaDB,
  HanaDBArgs,
} from "@langchain/community/vectorstores/hanavector";

const connectionParams = {
  host: process.env.HANA_HOST,
  port: process.env.HANA_PORT,
  user: process.env.HANA_UID,
  password: process.env.HANA_PWD,
};
const client = hanaClient.createClient(connectionParams);

// Connect to SAP HANA
await new Promise<void>((resolve, reject) => {
  client.connect((err: Error) => {
    if (err) {
      reject(err);
    } else {
      console.log("Connected to SAP HANA successfully.");
      resolve();
    }
  });
});

const docs: Document[] = [
  {
    pageContent: "First",
    metadata: { name: "Adam Smith", is_active: true, id: 1, height: 10.0 },
  },
  {
    pageContent: "Second",
    metadata: { name: "Bob Johnson", is_active: false, id: 2, height: 5.7 },
  },
  {
    pageContent: "Third",
    metadata: { name: "Jane Doe", is_active: true, id: 3, height: 2.4 },
  },
];

// Initialize embeddings
const embeddings = new OpenAIEmbeddings();

const args: HanaDBArgs = {
  connection: client,
  tableName: "testAdvancedFilters",
};

// Create a LangChain VectorStore interface for the HANA database and specify the table (collection) to use in args.
const vectorStore = new HanaDB(embeddings, args);
// need to initialize once an instance is created.
await vectorStore.initialize();
// Delete already existing documents from the table
await vectorStore.delete({ filter: {} });
await vectorStore.addDocuments(docs);

// Helper function to print filter results
function printFilterResult(result: Document[]) {
  if (result.length === 0) {
    console.log("<empty result>");
  } else {
    result.forEach((doc) => console.log(doc.metadata));
  }
}

let advancedFilter;

// Not equal
advancedFilter = { id: { $ne: 1 } };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"id":{"$ne":1}}
{ name: 'Bob Johnson', is_active: false, id: 2, height: 5.7 }
{ name: 'Jane Doe', is_active: true, id: 3, height: 2.4 }
*/

// Between range
advancedFilter = { id: { $between: [1, 2] } };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"id":{"$between":[1,2]}}
{ name: 'Adam Smith', is_active: true, id: 1, height: 10 }
{ name: 'Bob Johnson', is_active: false, id: 2, height: 5.7 } */

// In list
advancedFilter = { name: { $in: ["Adam Smith", "Bob Johnson"] } };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"name":{"$in":["Adam Smith","Bob Johnson"]}}
{ name: 'Adam Smith', is_active: true, id: 1, height: 10 }
{ name: 'Bob Johnson', is_active: false, id: 2, height: 5.7 } */

// Not in list
advancedFilter = { name: { $nin: ["Adam Smith", "Bob Johnson"] } };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"name":{"$nin":["Adam Smith","Bob Johnson"]}}
{ name: 'Jane Doe', is_active: true, id: 3, height: 2.4 } */

// Greater than
advancedFilter = { id: { $gt: 1 } };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"id":{"$gt":1}}
{ name: 'Bob Johnson', is_active: false, id: 2, height: 5.7 }
{ name: 'Jane Doe', is_active: true, id: 3, height: 2.4 } */

// Greater than or equal to
advancedFilter = { id: { $gte: 1 } };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"id":{"$gte":1}}
{ name: 'Adam Smith', is_active: true, id: 1, height: 10 }
{ name: 'Bob Johnson', is_active: false, id: 2, height: 5.7 }
{ name: 'Jane Doe', is_active: true, id: 3, height: 2.4 } */

// Less than
advancedFilter = { id: { $lt: 1 } };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"id":{"$lt":1}}
<empty result> */

// Less than or equal to
advancedFilter = { id: { $lte: 1 } };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"id":{"$lte":1}}
{ name: 'Adam Smith', is_active: true, id: 1, height: 10 } */

// Text filtering with $like
advancedFilter = { name: { $like: "a%" } };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"name":{"$like":"a%"}}
{ name: 'Adam Smith', is_active: true, id: 1, height: 10 } */

advancedFilter = { name: { $like: "%a%" } };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"name":{"$like":"%a%"}}
{ name: 'Adam Smith', is_active: true, id: 1, height: 10 }
{ name: 'Jane Doe', is_active: true, id: 3, height: 2.4 } */

// Text filtering with $contains
advancedFilter = { name: { $contains: "bob" } };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"name":{"$contains":"bob"}}
{ name: 'Bob Johnson', is_active: false, id: 2, height: 5.7 } */

advancedFilter = { name: { $contains: "bo" } };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"name":{"$contains":"bo"}}
<empty result> */

// Combined filtering with $or
advancedFilter = { $or: [{ id: 1 }, { name: "Bob Johnson" }] };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"$or":[{"id":1},{"name":"Bob Johnson"}]}
{ name: 'Adam Smith', is_active: true, id: 1, height: 10 }
{ name: 'Bob Johnson', is_active: false, id: 2, height: 5.7 } */

// Combined filtering with $and
advancedFilter = { $and: [{ id: 1 }, { id: 2 }] };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"$and":[{"id":1},{"id":2}]}
<empty result> */

advancedFilter = { $and: [{ name: { $contains: "bob" } }, { id: 2 }] };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"$and":[{"name":{"$contains":"bob"}},{"id":2}]}
{ name: 'Bob Johnson', is_active: false, id: 2, height: 5.7 } */

advancedFilter = { $or: [{ id: 1 }, { id: 2 }, { id: 3 }] };
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"$or":[{"id":1},{"id":2},{"id":3}]}
{ name: 'Adam Smith', is_active: true, id: 1, height: 10 }
{ name: 'Bob Johnson', is_active: false, id: 2, height: 5.7 }
{ name: 'Jane Doe', is_active: true, id: 3, height: 2.4 } */

// You can also define a nested filter with $and and $or.
advancedFilter = {
  $and: [{ $or: [{ id: 1 }, { id: 2 }] }, { height: { $gte: 5.0 } }],
};
console.log(`Filter: ${JSON.stringify(advancedFilter)}`);
printFilterResult(
  await vectorStore.similaritySearch("just testing", 5, advancedFilter)
);
/* Filter: {"$and":[{"$or":[{"id":1},{"id":2}]},{"height":{"$gte":5.0}}]}
{ name: 'Adam Smith', is_active: true, id: 1, height: 10 }
{ name: 'Bob Johnson', is_active: false, id: 2, height: 5.7 } */

// Disconnect from SAP HANA aft er the operations
client.disconnect();
