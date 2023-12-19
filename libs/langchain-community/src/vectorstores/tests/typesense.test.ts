import { Client } from "typesense";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "../../utils/testing.js";
import { Typesense } from "../typesense.js";

test("documentsToTypesenseRecords should return the correct typesense records", async () => {
  const embeddings = new FakeEmbeddings();
  const vectorstore = new Typesense(embeddings, {
    schemaName: "test",
    typesenseClient: {} as unknown as Client,
    columnNames: {
      vector: "vec",
      pageContent: "text",
      metadataColumnNames: ["foo", "bar", "baz"],
    },
  });

  const documents: Document[] = [
    {
      metadata: {
        id: "1",
        foo: "fooo",
        bar: "barr",
        baz: "bazz",
      },
      pageContent: "hello world",
    },
    {
      metadata: {
        id: "2",
        foo: "foooo",
        bar: "barrr",
        baz: "bazzz",
      },
      pageContent: "hello world 2",
    },
  ];

  const expected = [
    {
      text: "hello world",
      foo: "fooo",
      bar: "barr",
      baz: "bazz",
      vec: await embeddings.embedQuery("hello world"),
    },
    {
      text: "hello world 2",
      foo: "foooo",
      bar: "barrr",
      baz: "bazzz",
      vec: await embeddings.embedQuery("hello world 2"),
    },
  ];

  expect(
    await vectorstore._documentsToTypesenseRecords(
      documents,
      await embeddings.embedDocuments(["hello world", "hello world 2"])
    )
  ).toEqual(expected);
});

test("typesenseRecordsToDocuments should return the correct langchain documents", async () => {
  const embeddings = new FakeEmbeddings();
  const vectorstore = new Typesense(embeddings, {
    schemaName: "test",
    typesenseClient: {} as unknown as Client,
    columnNames: {
      vector: "vec",
      pageContent: "text",
      metadataColumnNames: ["foo", "bar", "baz"],
    },
  });

  const typesenseRecords = [
    {
      document: {
        text: "hello world",
        foo: "fooo",
        bar: "barr",
        baz: "bazz",
        vec: await embeddings.embedQuery("hello world"),
      },
      vector_distance: 0.2342145,
    },
    {
      document: {
        text: "hello world 2",
        foo: "foooo",
        bar: "barrr",
        baz: "bazzz",
        vec: await embeddings.embedQuery("hello world 2"),
      },
      vector_distance: 0.4521355,
    },
  ];

  const expected = [
    [
      {
        metadata: {
          foo: "fooo",
          bar: "barr",
          baz: "bazz",
        },
        pageContent: "hello world",
      },
      0.2342145,
    ],
    [
      {
        metadata: {
          foo: "foooo",
          bar: "barrr",
          baz: "bazzz",
        },
        pageContent: "hello world 2",
      },
      0.4521355,
    ],
  ];

  expect(vectorstore._typesenseRecordsToDocuments(typesenseRecords)).toEqual(
    expected
  );
});
