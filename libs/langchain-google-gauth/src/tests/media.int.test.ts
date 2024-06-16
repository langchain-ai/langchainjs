import { test } from "@jest/globals";
import { Blob } from "@langchain/google-common";
import {BlobStoreGoogleCloudStorage, BlobStoreGoogleCloudStorageParams} from "../media.js";

describe("GAuth GCS store", () => {

  test("save text no-metadata", async () => {
    const uri = `gs://test-langchainjs/text/test-${Date.now()}-nm`;
    const blob = new Blob({
      path: uri,
      mimetype: "text/plain",
      data: "This is a test",
    })
    const config: BlobStoreGoogleCloudStorageParams = {
    }
    const blobStore = new BlobStoreGoogleCloudStorage(config);
    console.log(blobStore.buildSetMetadata);
    const storedBlob = await blobStore.store(blob);
    console.log(storedBlob);
  });

  test("save text with-metadata", async () => {
    const uri = `gs://test-langchainjs/text/test-${Date.now()}-wm`;
    const blob = new Blob({
      path: uri,
      mimetype: "text/plain",
      data: "This is a test",
      metadata: {
        "alpha": "one",
        "bravo": "two",
      }
    })
    const config: BlobStoreGoogleCloudStorageParams = {
    }
    const blobStore = new BlobStoreGoogleCloudStorage(config);
    const storedBlob = await blobStore.store(blob);
    console.log(storedBlob);
  });

  test("get text no-metadata", async ()=> {
    const uri: string = "gs://test-langchainjs/test/test-nm";
    const config: BlobStoreGoogleCloudStorageParams = {
    }
    const blobStore = new BlobStoreGoogleCloudStorage(config);
    const blob = await blobStore.fetch(uri);
    console.log(blob);
  })

})