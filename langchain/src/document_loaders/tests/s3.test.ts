/* eslint-disable tree-shaking/no-side-effects-in-initialization */
import { test, jest, expect } from "@jest/globals";
// eslint-disable-next-line import/no-extraneous-dependencies
import S3Client from "@aws-sdk/client-s3";
import fs from "fs";
import { S3Loader } from "../s3.js";
import { UnstructuredLoader } from "../unstructured.js";

const fsMock = {
  ...fs,
  mkdtempSync: jest.fn().mockReturnValue("/tmp/s3fileloader-12345"),
  mkdirSync: jest.fn().mockImplementation(() => {
    console.log("Mock mkdirSync invoked");
  }),
  writeFileSync: jest.fn().mockImplementation(() => {
    console.log("Mock writeFileSync invoked");
  }),
};

const UnstructuredLoaderMock = jest.fn().mockImplementation(() => ({
  load: jest.fn().mockImplementation(() => ["fake document"]),
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockImplementation(() => ({
      Body: {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === "data") {
            (callback as (buffer: Buffer) => void)(
              Buffer.from("Mock file content")
            );
          } else if (event === "end") {
            (callback as (buffer?: Buffer) => void)(undefined);
          }
        }),
        pipe: jest.fn(),
      },
    })),
  })),
  GetObjectCommand: jest.fn(),
}));

test("Test S3 loader", async () => {
  if (!S3Client) {
    // this is to avoid a linting error. S3Client is mocked above.
  }

  const loader = new S3Loader(
    "test-bucket-123",
    "AccountingOverview.pdf",
    "http://localhost:8000/general/v0/general",
    fsMock as typeof fs,
    UnstructuredLoaderMock as typeof UnstructuredLoader
  );

  const result = await loader.load();

  expect(fsMock.mkdtempSync).toHaveBeenCalled();
  expect(fsMock.mkdirSync).toHaveBeenCalled();
  expect(fsMock.writeFileSync).toHaveBeenCalled();
  expect(UnstructuredLoaderMock).toHaveBeenCalledWith(
    "http://localhost:8000/general/v0/general",
    "/tmp/s3fileloader-12345/AccountingOverview.pdf"
  );
  expect(result).toEqual(["fake document"]);
});
