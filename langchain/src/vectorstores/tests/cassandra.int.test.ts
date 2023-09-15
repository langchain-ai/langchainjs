/* eslint-disable no-process-env */
import {test, expect, describe} from "@jest/globals";

import { CassandraStore } from "../cassandra.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { Document } from "../../document.js";

describe.only("CassandraStore", () => {

  const cassandraConfig = {
    cloud: {
      secureConnectBundle: process.env.CASSANDRA_SCB!,
    },
    credentials: {
      username: "token",
      password: process.env.CASSANDRA_TOKEN!,
    },
    keyspace: "test",
    dimensions: 1536,
    table: "test",
    primaryKey: {
      name: 'id',
      type: 'int',
    },
    metadataColumns: [{
      name: 'name',
      type: 'text'
    }]
  }


  test.only("CassandraStore.fromText", async () => {
    const vectorStore = await CassandraStore.fromTexts(
      ["Hello world", "Bye bye", "hello nice world"],
      [
        { id: 2, name: "2" },
        { id: 1, name: "1" },
        { id: 3, name: "3" },
      ],
      new OpenAIEmbeddings(),
      cassandraConfig
    );

    const results = await vectorStore.similaritySearch("hello world", 1);
    console.log("RESULTS:")
    console.log(results)
    expect(results).toEqual([
      new Document({
        pageContent: "Hello world",
        metadata: { id: 2, name: "2" },
      }),
    ]);
  });

  test("CassandraStore.fromExistingIndex", async () => {
    await CassandraStore.fromTexts(
      ["Hello world", "Bye bye", "hello nice world"],
      [
        { id: 2, name: "2" },
        { id: 1, name: "1" },
        { id: 3, name: "3" },
      ],
      new OpenAIEmbeddings(),
      cassandraConfig
    );

    const vectorStore = await CassandraStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      cassandraConfig,
    );

    const results = await vectorStore.similaritySearch("hello world", 1);
    expect(results).toEqual([
      new Document({
        pageContent: "Hello world",
        metadata: { id: 2, name: "2" },
      }),
    ]);
  });
});