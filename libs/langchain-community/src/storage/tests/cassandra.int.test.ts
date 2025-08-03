// /* eslint-disable no-process-env */
// Hangs when run with other tests, uncomment for development

// import { test, expect, describe } from "@jest/globals";
// import { CassandraClientFactory } from "../../utils/cassandra.js";
// import { CassandraKVStore } from "../cassandra.js";

test("Empty test to prevent runner from complaining", async () => {});

// const cassandraConfig = {
//   serviceProviderArgs: {
//     astra: {
//       token: process.env.ASTRA_TOKEN as string,
//       endpoint: process.env.ASTRA_DB_ENDPOINT as string,
//     },
//   },
//   keyspace: "test",
//   table: "test_kv",
// };

// let client;

// // For internal testing:
// //   1. switch "describe.skip(" to "describe("
// //   2. Export ASTRA_DB_ENDPOINT and ASTRA_TOKEN; "test" keyspace should exist
// //   3. cd langchainjs/libs/langchain-community
// //   4. pnpm test:single src/storage/tests/cassandra.int.test.ts
// // Once manual testing is complete, re-instate the ".skip"
// describe.skip("CassandraKVStore", () => {
//   let store: CassandraKVStore;

//   beforeAll(async () => {
//     client = await CassandraClientFactory.getClient(cassandraConfig);
//     await client.execute("DROP TABLE IF EXISTS test.test_kv;");
//     store = new CassandraKVStore(cassandraConfig);
//   });

//   test("CassandraKVStore can perform all operations", async () => {
//     // Using TextEncoder to simulate encoding of string data to binary format
//     const encoder = new TextEncoder();
//     const decoder = new TextDecoder();
//     const value1 = encoder.encode(new Date().toISOString());
//     const value2 = encoder.encode(
//       new Date().toISOString() + new Date().toISOString()
//     );

//     // mset
//     await store.mset([
//       ["key1", value1],
//       ["key2", value2],
//     ]);

//     // mget
//     const retrievedValues = await store.mget(["key1", "key2"]);
//     expect(retrievedValues.map((v) => decoder.decode(v))).toEqual([
//       decoder.decode(value1),
//       decoder.decode(value2),
//     ]);

//     // yieldKeys
//     const keys = [];
//     for await (const key of store.yieldKeys()) {
//       keys.push(key);
//     }
//     expect(keys).toContain("key1");
//     expect(keys).toContain("key2");

//     // mdelete
//     await store.mdelete(["key1", "key2"]);
//     const retrievedValuesAfterDelete = await store.mget(["key1", "key2"]);
//     expect(retrievedValuesAfterDelete).toEqual([undefined, undefined]);
//   });

//   describe.skip("CassandraKVStore key prefix retrieval", () => {
//     beforeAll(async () => {
//       client = await CassandraClientFactory.getClient(cassandraConfig);
//       await client.execute("DROP TABLE IF EXISTS test.test_kv;");
//       store = new CassandraKVStore(cassandraConfig);

//       await store.mset([
//         ["a/b/c", new TextEncoder().encode("value abc")],
//         ["a/b/d", new TextEncoder().encode("value abd")],
//         ["a/e/f", new TextEncoder().encode("value aef")],
//       ]);
//     });

//     test.each([
//       ["a", ["a/b/c", "a/b/d", "a/e/f"]],
//       ["a/", ["a/b/c", "a/b/d", "a/e/f"]],
//       ["a/b", ["a/b/c", "a/b/d"]],
//       ["a/b/", ["a/b/c", "a/b/d"]],
//       ["a/e", ["a/e/f"]],
//       ["a/e/", ["a/e/f"]],
//       ["b", []],
//     ])(
//       "yieldKeys with prefix '%s' returns expected keys",
//       async (prefix, expectedKeys) => {
//         const retrievedKeys = [];
//         for await (const key of store.yieldKeys(prefix)) {
//           retrievedKeys.push(key);
//         }
//         expect(retrievedKeys.sort()).toEqual(expectedKeys.sort());
//       }
//     );
//   });
// });
