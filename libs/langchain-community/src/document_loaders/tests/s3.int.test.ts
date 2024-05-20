/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, jest, expect } from "@jest/globals";
import S3Client from "@aws-sdk/client-s3";
import * as fs from "node:fs";
import * as path from "node:path";
import { S3Loader } from "../web/s3.js";
import { UnstructuredLoader } from "../fs/unstructured.js";

const fsMock = {
  ...fs,
  mkdtempSync: jest.fn().mockReturnValue("tmp/s3fileloader-12345"),
  mkdirSync: jest.fn().mockImplementation(() => {}),
  writeFileSync: jest.fn().mockImplementation((path, data) => {
    console.log(`Writing "${(data as object).toString()}" to ${path}`);
  }),
};

const UnstructuredLoaderMock = jest.fn().mockImplementation(() => ({
  load: jest.fn().mockImplementation(() => ["fake document"]),
}));

test.skip("Test S3 loader", async () => {
  if (!S3Client) {
    // this is to avoid a linting error. S3Client is mocked above.
  }

  const loader = new S3Loader({
    bucket: process.env.AWS_S3_BUCKET_NAME!,
    key: process.env.AWS_S3_KEY!,
    unstructuredAPIURL: "http://localhost:8000/general/v0/general",
    unstructuredAPIKey: "",
    fs: fsMock as typeof fs,
    UnstructuredLoader: UnstructuredLoaderMock as typeof UnstructuredLoader,
    s3Config: {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      region: process.env.AWS_REGION,
    },
  });

  const result = await loader.load();
  const unstructuredOptions = {
    apiUrl: "http://localhost:8000/general/v0/general",
    apiKey: "",
  };

  expect(fsMock.mkdtempSync).toHaveBeenCalled();
  expect(fsMock.mkdirSync).toHaveBeenCalled();
  expect(fsMock.writeFileSync).toHaveBeenCalled();
  expect(UnstructuredLoaderMock).toHaveBeenCalledWith(
    path.join("tmp", "s3fileloader-12345", "test.txt"),
    unstructuredOptions
  );
  expect(result).toEqual(["fake document"]);
});
