import fs from "fs/promises";
import { test } from "@jest/globals";
import { MediaBlob } from "@langchain/google-common";
import {BlobStoreGoogleCloudStorage, BlobStoreGoogleCloudStorageParams} from "../media.js";

describe("GAuth GCS store", () => {

  test("save text no-metadata", async () => {
    const uri = `gs://test-langchainjs/text/test-${Date.now()}-nm`;
    const blob = new MediaBlob({
      path: uri,
      data: new Blob(["This is a test"], {type: "text/plain"}),
    })
    const config: BlobStoreGoogleCloudStorageParams = {
    }
    const blobStore = new BlobStoreGoogleCloudStorage(config);
    const storedBlob = await blobStore.store(blob);
    console.log(storedBlob);
  });

  test("save text with-metadata", async () => {
    const uri = `gs://test-langchainjs/text/test-${Date.now()}-wm`;
    const blob = new MediaBlob({
      path: uri,
      data: new Blob(["This is a test"], {type: "text/plain"}),
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

  test("save image no-metadata", async () => {
    const filename = `src/tests/data/blue-square.png`;
    const dataBuffer = await fs.readFile(filename);
    const data = new Blob([dataBuffer], {type:"image/png"});

    const uri = `gs://test-langchainjs/image/test-${Date.now()}-nm`;
    const blob = new MediaBlob({
      path: uri,
      data,
    })
    const config: BlobStoreGoogleCloudStorageParams = {
    }
    const blobStore = new BlobStoreGoogleCloudStorage(config);
    const storedBlob = await blobStore.store(blob);
    console.log(storedBlob);
  });


  test("get text no-metadata", async ()=> {
    const uri: string = "gs://test-langchainjs/text/test-nm";
    const config: BlobStoreGoogleCloudStorageParams = {
    }
    const blobStore = new BlobStoreGoogleCloudStorage(config);
    const blob = await blobStore.fetch(uri);
    console.log(blob);
  })

  test("get text with-metadata", async ()=> {
    const uri: string = "gs://test-langchainjs/text/test-wm";
    const config: BlobStoreGoogleCloudStorageParams = {
    }
    const blobStore = new BlobStoreGoogleCloudStorage(config);
    const blob = await blobStore.fetch(uri);
    console.log(blob);
  })

  test("get image no-metadata", async ()=> {
    const uri: string = "gs://test-langchainjs/image/test-nm";
    const config: BlobStoreGoogleCloudStorageParams = {
    }
    const blobStore = new BlobStoreGoogleCloudStorage(config);
    const blob = await blobStore.fetch(uri);
    console.log(blob);
    console.log('blob data type', typeof blob?.data, blob?.data?.size)
  })

})