/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeEach, describe, expect, test } from "@jest/globals";
import { faker } from "@faker-js/faker";
import * as uuid from "uuid";
import { Document } from "../../document.js";
import { Chroma } from "../chroma.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";

describe("Chroma", () => {
  let chromaStore: Chroma;

  beforeEach(async () => {
    const embeddings = new OpenAIEmbeddings();
    chromaStore = new Chroma(embeddings, {
      url: "http://localhost:8000",
      collectionName: "test-collection",
    });
  });

  test("auto-generated ids", async () => {
    const pageContent = faker.lorem.sentence(5);

    await chromaStore.addDocuments([{ pageContent, metadata: { foo: "bar" } }]);

    const results = await chromaStore.similaritySearch(pageContent, 1);

    expect(results).toEqual([
      new Document({ metadata: { foo: "bar" }, pageContent }),
    ]);
  });

  test("metadata filtering", async () => {
    const pageContent = faker.lorem.sentence(5);
    const id = uuid.v4();

    await chromaStore.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: "qux" } },
    ]);

    // If the filter wasn't working, we'd get all 3 documents back
    const results = await chromaStore.similaritySearch(pageContent, 3, {
      foo: id,
    });

    expect(results).toEqual([
      new Document({ metadata: { foo: id }, pageContent }),
    ]);
  });
});
