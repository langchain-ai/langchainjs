import { test, jest, expect } from "@jest/globals";
import S3Client from "@aws-sdk/client-s3";
import * as fs from "node:fs";
import * as path from "node:path";
import { Readable } from "node:stream";
import { S3Loader } from "../web/s3.js";
import { UnstructuredLoader } from "../fs/unstructured.js";

const fsMock = {
  ...fs,
  mkdtempSync: jest.fn().mockReturnValue("tmp/s3fileloader-12345"),
  mkdirSync: jest.fn().mockImplementation(() => {}),
  writeFileSync: jest.fn().mockImplementation(() => {}),
};

const UnstructuredLoaderMock = jest.fn().mockImplementation(() => ({
  load: jest.fn().mockImplementation(() => ["fake document"]),
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockImplementation(() =>
      Promise.resolve({
        Body: new Readable({
          read() {
            this.push(Buffer.from("Mock file content"));
            this.push(null);
          },
        }),
      })
    ),
  })),
  GetObjectCommand: jest.fn(),
}));

test("Test S3 loader", async () => {
  if (!S3Client) {
    // this is to avoid a linting error. S3Client is mocked above.
  }

  const loader = new S3Loader({
    bucket: "test-bucket-123",
    key: "AccountingOverview.pdf",
    unstructuredAPIURL: "http://localhost:8000/general/v0/general",
    fs: fsMock as typeof fs,
    UnstructuredLoader: UnstructuredLoaderMock as typeof UnstructuredLoader,
  });

  const result = await loader.load();
  const unstructuredOptions = {
    apiUrl: "http://localhost:8000/general/v0/general",
  };

  expect(fsMock.mkdtempSync).toHaveBeenCalled();
  expect(fsMock.mkdirSync).toHaveBeenCalled();
  expect(fsMock.writeFileSync).toHaveBeenCalled();
  expect(UnstructuredLoaderMock).toHaveBeenCalledWith(
    path.join("tmp", "s3fileloader-12345", "AccountingOverview.pdf"),
    unstructuredOptions
  );
  expect(result).toEqual(["fake document"]);
});
