import { OpenAIEmbeddings } from "@langchain/openai";
import { TurbopufferVectorStore } from "@langchain/community/vectorstores/turbopuffer";

const embeddings = new OpenAIEmbeddings();

const store = new TurbopufferVectorStore(embeddings, {
  apiKey: process.env.TURBOPUFFER_API_KEY,
  namespace: "my-namespace",
});

const createdAt = new Date().getTime();

// Add some documents to your store.
// Currently, only string metadata values are supported.
const ids = await store.addDocuments([
  {
    pageContent: "some content",
    metadata: { created_at: createdAt.toString() },
  },
  { pageContent: "hi", metadata: { created_at: (createdAt + 1).toString() } },
  { pageContent: "bye", metadata: { created_at: (createdAt + 2).toString() } },
  {
    pageContent: "what's this",
    metadata: { created_at: (createdAt + 3).toString() },
  },
]);

// Retrieve documents from the store
const results = await store.similaritySearch("hello", 1);

console.log(results);
/*
  [
    Document {
      pageContent: 'hi',
      metadata: { created_at: '1705519164987' }
    }
  ]
*/

// Filter by metadata
// See https://turbopuffer.com/docs/reference/query#filter-parameters for more on
// allowed filters
const results2 = await store.similaritySearch("hello", 1, {
  created_at: [["Eq", (createdAt + 3).toString()]],
});

console.log(results2);

/*
  [
    Document {
      pageContent: "what's this",
      metadata: { created_at: '1705519164989' }
    }
  ]
*/

// Upsert by passing ids
await store.addDocuments(
  [
    { pageContent: "changed", metadata: { created_at: createdAt.toString() } },
    {
      pageContent: "hi changed",
      metadata: { created_at: (createdAt + 1).toString() },
    },
    {
      pageContent: "bye changed",
      metadata: { created_at: (createdAt + 2).toString() },
    },
    {
      pageContent: "what's this changed",
      metadata: { created_at: (createdAt + 3).toString() },
    },
  ],
  { ids }
);

// Filter by metadata
const results3 = await store.similaritySearch("hello", 10, {
  created_at: [["Eq", (createdAt + 3).toString()]],
});

console.log(results3);

/*
  [
    Document {
      pageContent: "what's this changed",
      metadata: { created_at: '1705519164989' }
    }
  ]
*/

// Remove all vectors from the namespace.
await store.delete({
  deleteIndex: true,
});
