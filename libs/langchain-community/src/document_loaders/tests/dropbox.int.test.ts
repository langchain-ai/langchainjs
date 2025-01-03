/**
 * NOTE: DROPBOX_ACCESS_TOKEN should be set in environment variables
 * NOTE: files.content.write permission is required for testing.
 */
import { expect } from "@jest/globals";
import * as url from "node:url";
import * as path from "node:path";
import * as fs from "node:fs";
import { v4 as uuid } from "uuid";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Document } from "@langchain/core/documents";
import { Dropbox, DropboxOptions } from "dropbox";

import {
  UnstructuredDirectoryLoader,
  UnstructuredLoader,
  UnstructuredLoaderOptions,
} from "../fs/unstructured.js";
import { DropboxLoader } from "../web/dropbox.js";

// Copies over the dropbox example_data to the remote dropbox drive.
const setupDropboxStorageEnvironment = async (
  localPath: string,
  dropboxPath: string,
  dbx: Dropbox
) => {
  for (const item of fs.readdirSync(localPath)) {
    const fullPath = path.join(localPath, item);
    const dbxPath = `${dropboxPath}/${item}`;
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      try {
        await dbx.filesCreateFolderV2({ path: dbxPath });
      } catch {
        // Ignore folder already exists or auth error
      }
      await setupDropboxStorageEnvironment(fullPath, dbxPath, dbx);
    } else {
      await dbx.filesUpload({
        path: dbxPath,
        contents: fs.readFileSync(fullPath),
        mode: { ".tag": "overwrite" },
      });
    }
  }
};

// Removes the dropbox example_data from the remote dropbox drive.
const teardownDropboxStorageEnvironment = async (
  dropboxPath: string,
  dbx: Dropbox
) => {
  try {
    await dbx.filesDeleteV2({ path: dropboxPath });
  } catch {
    // Folder might not exist or auth error.
  }
};

describe("DropboxLoader Integration Tests", () => {
  // Ensure the enviroment variables are set

  const localTestDataFolder = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/dropbox"
  );
  const dropboxTestDataFolder = `/LangchainDropboxLoaderTest_${uuid()}`;
  const folder1Files = ["example.txt", "example2.txt"];
  const folder2Files = ["Jacob_Lee_Resume_2023.pdf"];
  const rootFiles = ["hello.txt"];
  const allTestFiles = [...rootFiles, ...folder1Files, ...folder2Files];

  // Copies over the dropbox example_data over to dropbox drive
  beforeAll(() => {
    const accessToken = getEnvironmentVariable("DROPBOX_ACCESS_TOKEN");
    const dbx = new Dropbox({ accessToken });
    return setupDropboxStorageEnvironment(
      localTestDataFolder,
      dropboxTestDataFolder,
      dbx
    );
  });

  // Cleanup and removes the added dropbox example_date during setup.
  afterAll(() => {
    const accessToken = getEnvironmentVariable("DROPBOX_ACCESS_TOKEN");
    const dbx = new Dropbox({ accessToken });
    return teardownDropboxStorageEnvironment(dropboxTestDataFolder, dbx);
  });

  // Integration tests for the load method
  describe("load", () => {
    it("should load documents from a Dropbox file", async () => {
      const localFilename = folder2Files[0];
      const dropboxFilePath = path.join(
        dropboxTestDataFolder,
        "folder_2",
        localFilename
      );
      const localFilePath = path.join(
        localTestDataFolder,
        "folder_2",
        localFilename
      );

      const unstructuredOptions: UnstructuredLoaderOptions = {
        apiKey: undefined,
        apiUrl: "http://localhost:8000/general/v0/general",
      };

      const clientOptions: DropboxOptions = {};
      const dropboxLoader = new DropboxLoader({
        clientOptions,
        unstructuredOptions,
        filePaths: [dropboxFilePath],
      });

      const directoryLoader = new UnstructuredLoader(
        localFilePath,
        unstructuredOptions
      );

      const [dropboxDocuments, directoryDocuments] = await Promise.all([
        dropboxLoader.load(),
        directoryLoader.load(),
      ]);

      expect(dropboxDocuments).toBeDefined();
      expect(dropboxDocuments.length).toBe(directoryDocuments.length);

      const dropboxSourcePath = "dropbox://" + dropboxFilePath;

      dropboxDocuments.forEach((doc) => {
        expect(doc).toBeInstanceOf(Document);
        expect(doc.pageContent).toBeDefined();
        expect(folder2Files).toContain(doc.metadata.filename);
        expect(dropboxSourcePath).toEqual(doc.metadata.source);
      });
    });

    it("should load all documents from a Dropbox folder", async () => {
      const dropboxFilenames = folder1Files.map((path) => path.toLowerCase());

      const dropboxFolderPath = path.join(dropboxTestDataFolder, "folder_1");
      const localFolderPath = path.join(localTestDataFolder, "folder_1");

      const clientOptions: DropboxOptions = {};
      const unstructuredOptions: UnstructuredLoaderOptions = {
        apiKey: "",
        apiUrl: "http://localhost:8000/general/v0/general",
      };

      const dropboxLoader = new DropboxLoader({
        clientOptions,
        unstructuredOptions,
        mode: "directory",
        folderPath: dropboxFolderPath,
      });

      const directoryLoader = new UnstructuredDirectoryLoader(
        localFolderPath,
        unstructuredOptions
      );

      const [dropboxDocuments, directoryDocuments] = await Promise.all([
        dropboxLoader.load(),
        directoryLoader.load(),
      ]);

      expect(dropboxDocuments).toBeDefined();
      expect(dropboxDocuments.length).toBe(directoryDocuments.length);

      const dropboxSourcePath = folder1Files.map(
        (filename) =>
          "dropbox://" + path.join(dropboxFolderPath, filename).toLowerCase()
      );

      dropboxDocuments.forEach((doc) => {
        expect(doc).toBeInstanceOf(Document);
        expect(doc.pageContent).toBeDefined();
        expect(dropboxFilenames).toContain(doc.metadata.filename);
        expect(dropboxSourcePath).toContain(doc.metadata.source);
      });
    });

    it("should recursively load all documents from a Dropbox folder", async () => {
      const dropboxFilenames = allTestFiles;

      const clientOptions: DropboxOptions = {};
      const unstructuredOptions: UnstructuredLoaderOptions = {
        apiKey: "",
        apiUrl: "http://localhost:8000/general/v0/general",
      };

      const dropboxLoader = new DropboxLoader({
        clientOptions,
        unstructuredOptions,
        mode: "directory",
        folderPath: dropboxTestDataFolder,
        recursive: true,
      });

      const directoryLoader = new UnstructuredDirectoryLoader(
        localTestDataFolder,
        unstructuredOptions
      );

      const [dropboxDocuments, directoryDocuments] = await Promise.all([
        dropboxLoader.load(),
        directoryLoader.load(),
      ]);

      expect(dropboxDocuments).toBeDefined();
      expect(dropboxDocuments.length).toBe(directoryDocuments.length);

      dropboxDocuments.forEach((doc) => {
        expect(doc).toBeInstanceOf(Document);
        expect(doc.pageContent).toBeDefined();
        expect(dropboxFilenames).toContain(doc.metadata.filename);
      });
    });
  });
});
