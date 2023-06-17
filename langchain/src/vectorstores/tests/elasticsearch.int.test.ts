/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeEach, describe, expect, test } from "@jest/globals";
import { faker } from "@faker-js/faker";
import * as uuid from "uuid";
import { Document } from "../../document.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { ElasticSearchLibArgs, ElasticSearchStore } from "../elasticsearch.js";

describe("ElasticSearchStore", () => {
  let store: ElasticSearchStore;

  beforeEach(async () => {
    const clientArgs: ElasticSearchLibArgs = {
      clientOptions: {
        node: process.env.ELASTICSEARCH_URL,
      },
    };

    const embeddings = new OpenAIEmbeddings();
    store = new ElasticSearchStore(embeddings, clientArgs);
  });

  test("search", async () => {
    const pageContent = faker.lorem.sentence(5);

    await store.addDocuments([{ pageContent, metadata: { foo: "bar" } }]);

    const results = await store.similaritySearch(pageContent, 1);

    expect(results).toEqual([
      new Document({ metadata: { foo: "bar" }, pageContent }),
    ]);
  });

  test("metadata filtering", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    await store.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: "qux" } },
    ]);

    // If the filter wasn't working, we'd get all 3 documents back
    const results = await store.similaritySearch(pageContent, 3, {
      foo: id,
    });

    expect(results).toEqual([
      new Document({ metadata: { foo: id }, pageContent }),
    ]);
  });
});
