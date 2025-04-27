/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import weaviate,
 {  Filters }
 from "weaviate-client";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { WeaviateStore } from "../vectorstores.js";
import * as dotenv from "dotenv";

dotenv.config();

test.skip("WeaviateStore", async () => {

   const client = await (weaviate as any).connectToWeaviateCloud(
    process.env.WEAVIATE_URL, { 
      authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ''),
      headers: {
        'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY || '',  
        "X-Azure-Api-Key": process.env.AZURE_OPENAI_API_KEY || '',  
      }
    }
  );

  const embeddings = new OpenAIEmbeddings();
  const weaviateArgs = {
    client,
    indexName: "Test",
    textKey: "text",
    metadataKeys: ["foo"],
  }
  const collection = client.collections.get(weaviateArgs.indexName)

  const store = await WeaviateStore.fromTexts(
    ["hello world", "hi there", "how are you", "bye now"],
    [{ foo: "bar" }, { foo: "baz" }, { foo: "qux" }, { foo: "bar" }],
    embeddings,
    weaviateArgs
  );
  
  const results = await store.similaritySearch("hello world", 1);
  expect(results).toEqual([
    new Document({ id: expect.any(String) as any, pageContent: "hello world", metadata: { foo: "bar" } }),
  ]);

  const results2 = await store.similaritySearch("hello world", 1, 
    Filters.and(collection.filter.byProperty('foo').equal('baz') )
  );

  expect(results2).toEqual([
    new Document({  id: expect.any(String) as any, pageContent: "hi there", metadata: { foo: "baz" } }),
  ]);

  const testDocumentWithObjectMetadata = new Document({
    pageContent: "this is the deep document world!",
    metadata: {
      deep: {
        string: "deep string",
        deepdeep: {
          string: "even a deeper string",
        },
      },
    },
  });
  const documentStore = await WeaviateStore.fromDocuments(
    [testDocumentWithObjectMetadata],
    new OpenAIEmbeddings(),
    {
      client,
      indexName: "DocumentTest",
      textKey: "text",
      metadataKeys: ["deep_string", "deep_deepdeep_string"],
    }
  );
  await sleep(3000);
  const result3 = await documentStore.similaritySearch(
    "this is the deep document world!",
    1, 
    Filters.and(collection.filter.byProperty('deep_string').equal('deep string'))
  );
  expect(result3).toEqual([
    new Document({
      id: expect.any(String) as any,
      pageContent: "this is the deep document world!",
      metadata: {
        deep_string: "deep string",
        deep_deepdeep_string: "even a deeper string",
      },
    }),
  ]);
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// test("WeaviateStore upsert + delete", async () => {
//   const client = await (weaviate as any).connectToWeaviateCloud(
//     process.env.WEAVIATE_URL, { 
//       authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ''),
//       headers: {
//         'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY || '',  
//         "X-Azure-Api-Key": process.env.AZURE_OPENAI_API_KEY || '',  
//       }
//     }
//   );

//   const createdAt = new Date().getTime();
//   const weaviateArgs = {
//     client,
//     indexName: "DocumentTest",
//     textKey: "pageContent",
//     metadataKeys: ["deletionTest"],
//   }
//   const collection = client.collections.get(weaviateArgs.indexName)
//   const store = await WeaviateStore.fromDocuments(
//     [
//       new Document({
//         pageContent: "testing",
//         metadata: { deletionTest: createdAt.toString() },
//       }),
//     ],
//     new OpenAIEmbeddings(),
//     weaviateArgs
//   );

//   const ids = await store.addDocuments([
//     {
//       pageContent: "hello world",
//       metadata: { deletionTest: (createdAt + 1).toString() },
//     },
//     {
//       pageContent: "hello world",
//       metadata: { deletionTest: (createdAt + 1).toString() },
//     },
//   ]);
//   await sleep(3000);

//   const results = await store.similaritySearch("hello world", 4, 
//     collection.filter.byProperty('deletionTest').equal((createdAt + 1).toString())
//   );

//   expect(results).toEqual([
//     new Document({
//       id: expect.any(String) as any,
//       pageContent: "hello world",
//       metadata: { deletionTest: (createdAt + 1).toString() },
//     }),
//     new Document({
//       id: expect.any(String) as any,
//       pageContent: "hello world",
//       metadata: { deletionTest: (createdAt + 1).toString() },
//     }),
//   ]);

//   const ids2 = await store.addDocuments(
//     [
//       {
//         pageContent: "hello world upserted",
//         metadata: { deletionTest: (createdAt + 1).toString() },
//       },
//       {
//         pageContent: "hello world upserted",
//         metadata: { deletionTest: (createdAt + 1).toString() },
//       },
//     ],
//     { ids }
//   );

//   expect(ids2).toEqual(ids);

//   const results2 = await store.similaritySearch("hello world", 4, 
//     Filters.and(collection.filter.byProperty('deletionTest').equal((createdAt + 1).toString()))
// );
//   expect(results2).toEqual([
//     new Document({
//       id: expect.any(String) as any,
//       pageContent: "hello world upserted",
//       metadata: { deletionTest: (createdAt + 1).toString() },
//     }),
//     new Document({
//       id: expect.any(String) as any,
//       pageContent: "hello world upserted",
//       metadata: { deletionTest: (createdAt + 1).toString() },
//     }),
//   ]);

//   await store.delete({ ids: ids.slice(0, 1) });
//   await sleep(3000);

//   const results3 = await store.similaritySearch("hello world", 1,
//     Filters.and(collection.filter.byProperty('deletionTest').equal((createdAt + 1).toString()))
// );
//   expect(results3).toEqual([
//     new Document({
//       id: expect.any(String) as any,
//       pageContent: "hello world upserted",
//       metadata: { deletionTest: (createdAt + 1).toString() },
//     }),
//   ]);
// });

// test("WeaviateStore delete with filter", async () => {
//   const client = await (weaviate as any).connectToWeaviateCloud(
//     process.env.WEAVIATE_URL, { 
//       authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ''),
//       headers: {
//         'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY || '',  
//         "X-Azure-Api-Key": process.env.AZURE_OPENAI_API_KEY || '',  
//       }
//     }
//   );

//   const weaviateArgs = {
//     client,
//     indexName: "Test",
//     textKey: "text",
//     metadataKeys: ["foo"],
//   }
//   const collection = client.collections.get(weaviateArgs.indexName)

//   const store = await WeaviateStore.fromTexts(
//     ["hello world", "hi there", "how are you", "bye now"],
//     [{ foo: "bar" }, { foo: "baz" }, { foo: "qux" }, { foo: "bar" }],
//     new OpenAIEmbeddings(),
//     weaviateArgs
//   );
//   await sleep(3000);
//   const results = await store.similaritySearch("hello world", 1);
//   expect(results).toEqual([
//     new Document({ id: expect.any(String) as any, pageContent: "hello world", metadata: { foo: "bar" } }),
//   ]);
//   await store.delete({
//     filter: collection.filter.byProperty('foo').equal('bar')
//   });
//   await sleep(3000);
//   const results2 = await store.similaritySearch("hello world", 1, 
//     collection.filter.byProperty('foo').equal('bar')
//   );
//   expect(results2).toEqual([]);
// });

// test("Initializing via constructor", () => {
//   const client = (weaviate as any).connectToWeaviateCloud(
//         process.env.WEAVIATE_URL, { 
//           authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ''),
//           headers: {
//             'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY || '',  
//             "X-Azure-Api-Key": process.env.AZURE_OPENAI_API_KEY || '',  
//           }
//         }
//       );
//   const store = new WeaviateStore(new OpenAIEmbeddings(), {
//     client,
//     indexName: "Test",
//     textKey: "text",
//     metadataKeys: ["foo"],
//   });

//   expect(store).toBeDefined();
//   expect(store._vectorstoreType()).toBe("weaviate");
// });

// test("addDocuments & addVectors method works", async () => {

//   const client = await (weaviate as any).connectToWeaviateCloud(
//     process.env.WEAVIATE_URL, { 
//       authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ''),
//       headers: {
//         'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY || '',  
//         "X-Azure-Api-Key": process.env.AZURE_OPENAI_API_KEY || '',  
//       }
//     }
//   );

//   const store = new WeaviateStore(new OpenAIEmbeddings(), {
//     client,
//     indexName: "Test",
//     textKey: "text",
//     metadataKeys: ["foo"],
//   });

//   const documents = [
//     new Document({ pageContent: "hello world", metadata: { foo: "bar" } }),
//     new Document({ pageContent: "hi there", metadata: { foo: "baz" } }),
//     new Document({ pageContent: "how are you", metadata: { foo: "qux" } }),
//     new Document({ pageContent: "bye now", metadata: { foo: "bar" } }),
//   ];

//   const embeddings = await store.embeddings.embedDocuments(
//     documents.map((d) => d.pageContent)
//   );

//   const vectors = await store.addVectors(embeddings, documents);

//   expect(vectors).toHaveLength(4);
// });

// test("maxMarginalRelevanceSearch", async () => {
//   const client = await (weaviate as any).connectToWeaviateCloud(
//     process.env.WEAVIATE_URL, { 
//       authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ''),
//       headers: {
//         'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY || '',  
//         "X-Azure-Api-Key": process.env.AZURE_OPENAI_API_KEY || '',  
//       }
//     }
//   );

//   const createdAt = new Date().getTime();

//   const fatherDoc = new Document({
//     pageContent: "hello father",
//     metadata: { deletionTest: (createdAt + 3).toString() },
//   });

//   const store = await WeaviateStore.fromDocuments(
//     [
//       new Document({
//         pageContent: "testing",
//         metadata: { deletionTest: createdAt.toString() },
//       }),
//       new Document({
//         pageContent: "hello world",
//         metadata: { deletionTest: (createdAt + 1).toString() },
//       }),
//       new Document({
//         pageContent: "hello mother",
//         metadata: { deletionTest: (createdAt + 2).toString() },
//       }),
//       fatherDoc,
//     ],
//     new OpenAIEmbeddings(),
//     {
//       client,
//       indexName: "DocumentTest",
//       textKey: "pageContent",
//       metadataKeys: ["deletionTest"],
//     }
//   );

//   await sleep(3000);
//   const result = await store.maxMarginalRelevanceSearch("father", { k: 1 });
//   // console.log(result)
//   expect(result[0].pageContent).toEqual(fatherDoc.pageContent);
// });

// test("fromExistingIndex", async () => {
//   const client = await (weaviate as any).connectToWeaviateCloud(
//     process.env.WEAVIATE_URL, { 
//       authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ''),
//       headers: {
//         'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY || '',  
//         "X-Azure-Api-Key": process.env.AZURE_OPENAI_API_KEY || '',  
//       }
//     }
//   );

//   const store = await WeaviateStore.fromExistingIndex(new OpenAIEmbeddings(), {
//     client,
//     indexName: "DocumentTest",
//     textKey: "pageContent",
//     metadataKeys: ["deletionTest"],
//   });

//   expect(store).toBeDefined();
//   expect(store._vectorstoreType()).toBe("weaviate");
// });
