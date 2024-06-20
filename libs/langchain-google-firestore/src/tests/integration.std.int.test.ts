import {
  describe,
  expect,
  test,
  beforeAll,
  afterEach,
  jest,
} from "@jest/globals";
import * as uuid from "uuid";
import { GoogleAuth } from "google-auth-library";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { FirestoreVectorStore, FirebaseStoreParams } from "../vectorstores.js"; // Adjust the path as necessary

jest.mock("@google-cloud/firestore");
jest.mock("uuid");

describe("FirestoreVectorStore", () => {
  let firestoreVectorStore: FirestoreVectorStore;
  const collectionName = "testCollection";
  const embeddings = new FakeEmbeddings();
  const googleAuth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  beforeAll(() => {
    const firestoreConfig = {};
    const params: FirebaseStoreParams = {
      firestoreConfig,
      collectionName,
      textKey: "text",
      distanceMeasure: "EUCLIDEAN",
      googleAuth,
    };
    firestoreVectorStore = new FirestoreVectorStore({ embeddings, params });
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  test("user-provided ids", async () => {
    const documentId = uuid.v4();
    const pageContent = "Test conteent";

    const ids = await firestoreVectorStore.addDocuments(
      [{ pageContent, metadata: {} }],
      {
        ids: [documentId],
      }
    );

    expect(ids).toEqual([documentId]);

    await firestoreVectorStore.addDocuments(
      [{ pageContent: `${pageContent} upsedeesrted`, metadata: {} }],
      { ids: [documentId] }
    );

    const updatedDocument = await firestoreVectorStore.getDocumentById(
      documentId
    );
    expect(updatedDocument).toEqual(
      new Document({
        metadata: { text: `${pageContent} upserted` },
        pageContent: `${pageContent} upserted`,
      })
    );
  });

  test("auto-generated ids", async () => {
    const pageContent = "Test content with auto ID";

    const ids = await firestoreVectorStore.addDocuments([
      { pageContent, metadata: { foo: "bar" } },
    ]);

    expect(ids.length).toEqual(1);
    expect(typeof ids[0]).toBe("string");

    const storedDocument = await firestoreVectorStore.getDocumentById(ids[0]);
    expect(storedDocument).toEqual(
      new Document({ metadata: { foo: "bar", text: pageContent }, pageContent })
    );
  });

  test("similarity search", async () => {
    const queryVector = await embeddings.embedQuery("This is a second.");
    const searchResults =
      await firestoreVectorStore.similaritySearchVectorWithScore(
        queryVector,
        3
      );

    expect(searchResults).toHaveLength(3);
  });

  test("delete all", async () => {
    const pageContent = "Test content to delete all";
    const id = uuid.v4();

    await firestoreVectorStore.addDocuments([
      { pageContent, metadata: { foo: id } },
      { pageContent, metadata: { foo: id } },
    ]);

    await firestoreVectorStore.delete({
      deleteAll: true,
    });

    const remainingDocuments =
      await firestoreVectorStore.getDocumentsByMetadata({
        foo: id,
      });

    expect(remainingDocuments.length).toEqual(0);
  });

  test("get document by id", async () => {
    const documentId = uuid.v4();
    const pageContent = "Test content";
    await firestoreVectorStore.addDocuments([{ pageContent, metadata: {} }], {
      ids: [documentId],
    });

    const document = await firestoreVectorStore.getDocumentById(documentId);
    expect(document).toEqual(
      new Document({ metadata: { text: pageContent }, pageContent })
    );

    console.log("-------------------Documents by ID-------------------");
    console.log(document);
    console.log("------------------Done-------------------");
  });

  test("get documents by metadata", async () => {
    const pageContent = "Test content";
    const metadata = { foo: "bar" };
    await firestoreVectorStore.addDocuments([{ pageContent, metadata }]);

    const documents = await firestoreVectorStore.getDocumentsByMetadata(
      metadata
    );
    console.log("-------------------Documents by Metadata-------------------");
    console.log(documents);
    console.log("------------------Done-------------------");
    expect(documents).toEqual([
      new Document({
        metadata: { foo: "bar", text: pageContent },
        pageContent,
      }),
    ]);
  });

  test("delete documents by IDs", async () => {
    const pageContent = "Test content to delete by ID";
    const documentId = uuid.v4();

    await firestoreVectorStore.addDocuments([{ pageContent, metadata: {} }], {
      ids: [documentId],
    });

    await firestoreVectorStore.delete({
      ids: [documentId],
    });

    const deletedDocument = await firestoreVectorStore.getDocumentById(
      documentId
    );
    expect(deletedDocument).toBeNull();
  });

  test("delete documents by filter", async () => {
    const pageContent = "Test content to delete by filter";
    const filter = { foo: "bar" };

    await firestoreVectorStore.addDocuments([
      { pageContent, metadata: filter },
    ]);

    await firestoreVectorStore.delete({
      filter,
    });

    const remainingDocuments =
      await firestoreVectorStore.getDocumentsByMetadata(filter);
    expect(remainingDocuments.length).toEqual(0);
  });

  test("add vectors directly", async () => {
    const pageContent = "Test content with direct vector addition";
    const vector = [1, 2, 3];
    const documentId = uuid.v4();

    await firestoreVectorStore.addVectors(
      [vector],
      [{ pageContent, metadata: {} }],
      { ids: [documentId] }
    );

    const storedDocument = await firestoreVectorStore.getDocumentById(
      documentId
    );
    expect(storedDocument).toEqual(
      new Document({
        metadata: { text: pageContent },
        pageContent,
      })
    );
  });
});
