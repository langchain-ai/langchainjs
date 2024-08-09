import { test, expect } from "@jest/globals";
import { UnstructuredClient } from "unstructured-client";
import { UnstructuredLoader } from "../document_loaders.js";

test("Can not pass apiKey or serverURL if passing a custom client", () => {
  const customClient = new UnstructuredClient();

  expect(() => {
    const loader = new UnstructuredLoader(
      {
        filePath: "filePath",
      },
      {
        client: customClient,
        apiKey: "apiKey",
        serverURL: "serverURL",
      }
    );
    if (loader) {
      // Loader should never be true, since it should throw an error.
    }
  }).toThrowError();

  expect(() => {
    const loader = new UnstructuredLoader(
      {
        filePath: "filePath",
      },
      {
        client: customClient,
        serverURL: "serverURL",
      }
    );
    if (loader) {
      // Loader should never be true, since it should throw an error.
    }
  }).toThrowError();

  expect(() => {
    const loader = new UnstructuredLoader(
      {
        filePath: "filePath",
      },
      {
        client: customClient,
        apiKey: "apiKey",
      }
    );
    if (loader) {
      // Loader should never be true, since it should throw an error.
    }
  }).toThrowError();
});
