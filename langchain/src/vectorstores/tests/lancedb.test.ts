import { test, expect } from "@jest/globals";
import { connect, Table } from "vectordb";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { LanceDB } from "../lancedb.js";
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { Document } from "../../document.js";

describe("LanceDB", () => {
  test("constructor works", async () => {
    const lancedb = new LanceDB(new FakeEmbeddings(), {
      table: new Table(null, "vectors"),
    });
    expect(lancedb).toBeDefined();
  });

  test("should add vectors to the table", async () => {
    const embeddings = new FakeEmbeddings();
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lcjs-lancedb-"));
    const db = await connect(dir);
    const table = await db.createTable("vectors", [
      { vector: [0, 1], text: "sample", id: 1 },
    ]);
    const lanceDBStore = new LanceDB(embeddings, { table });

    await lanceDBStore.addVectors(
      [
        [10, 9],
        [10, 10],
        [100, 100],
      ],
      [
        new Document({
          pageContent: "hello bye",
          metadata: { id: 10 },
        }),
        new Document({
          pageContent: "hello world",
          metadata: { id: 11 },
        }),
        new Document({
          pageContent: "bye bye",
          metadata: { id: 12 },
        }),
      ]
    );

    const results2 = await table.search([10, 9]).limit(2).execute();
    expect(results2.length).toBe(2);

    const results = await lanceDBStore.similaritySearchVectorWithScore(
      [10, 9],
      2
    );
    expect(results.length).toBe(2);

    // score
    expect(results[0][1]).toBe(0);
    const doc1 = results[0][0];
    expect(doc1.pageContent).toEqual("hello bye");
    expect(doc1.metadata.id).toEqual(10);

    // score
    expect(results[1][1]).toBe(1);
    const doc2 = results[1][0];
    expect(doc2.pageContent).toEqual("hello world");
    expect(doc2.metadata.id).toEqual(11);
  });
});
