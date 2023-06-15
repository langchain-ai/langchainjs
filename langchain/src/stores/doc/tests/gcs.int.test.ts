import { describe, test, expect } from "@jest/globals";
import { GoogleCloudStorageDocstore } from "../gcs.js";
import { Document } from "../../../document.js";

describe.skip("GoogleCloudStorageDocstore", () => {
  const bucket = "INSERT_BUCKET_HERE";

  test("save", async () => {
    const name = "test1";
    const pageContent = "This is a test";
    const document = new Document({ pageContent });

    const store = new GoogleCloudStorageDocstore({
      bucket,
    });
    await store.addDocument(name, document);
  });

  test("save metadata", async () => {
    const name = "test2";
    const pageContent = "This is a metadata test";
    const metadata = {
      meta1: "one",
      meta2: "two",
    };
    const document = new Document({ pageContent, metadata });

    const store = new GoogleCloudStorageDocstore({
      bucket,
    });
    await store.addDocument(name, document);
  });

  test("save prefix", async () => {
    const prefix = "prefix/";
    const name = "test3";
    const pageContent = "This is a prefix test";
    const document = new Document({ pageContent });

    const store = new GoogleCloudStorageDocstore({
      bucket,
      prefix,
    });
    await store.addDocument(name, document);
  });

  test("load", async () => {
    const name = "test1";
    const store = new GoogleCloudStorageDocstore({
      bucket,
    });
    const document = await store.search(name);
    console.log(document);
    expect(document.pageContent).toEqual("This is a test");
  });

  test("load metadata", async () => {
    const name = "test2";
    const store = new GoogleCloudStorageDocstore({
      bucket,
    });
    const document = await store.search(name);
    console.log(document);
    expect(document.pageContent).toEqual("This is a metadata test");
    expect(document.metadata.meta1).toEqual("one");
  });

  test("load prefix", async () => {
    const prefix = "prefix/";
    const name = "test3";
    const store = new GoogleCloudStorageDocstore({
      bucket,
      prefix,
    });
    const document = await store.search(name);
    console.log(document);
    expect(document.pageContent).toEqual("This is a prefix test");
  });
});
