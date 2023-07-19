import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { BlobServiceClient } from "@azure/storage-blob";
import { BaseDocumentLoader } from "../base.js";
import {
  UnstructuredLoader,
  UnstructuredLoaderOptions,
} from "../fs/unstructured.js";

export class AzureBlobStorageFileLoader extends BaseDocumentLoader {
  private readonly connStr: string;

  private readonly container: string;

  private readonly blobName: string;

  private readonly unstructuredLoaderOptions: UnstructuredLoaderOptions;

  constructor(
    connStr: string,
    container: string,
    blobName: string,
    unstructuredLoaderOptions: UnstructuredLoaderOptions
  ) {
    super();
    this.connStr = connStr;
    this.container = container;
    this.blobName = blobName;
    this.unstructuredLoaderOptions = unstructuredLoaderOptions;
  }

  public async load() {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      this.connStr
    );

    const containerClient = blobServiceClient.getContainerClient(
      this.container
    );

    const blobClient = await containerClient.getBlobClient(this.blobName);

    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "azureblobfileloader-")
    );

    const filePath = path.join(tempDir, this.blobName);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    await blobClient.downloadToFile(filePath);

    try {
      const unstructuredLoader = new UnstructuredLoader(
        filePath,
        this.unstructuredLoaderOptions
      );

      const docs = await unstructuredLoader.load();

      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });

      return docs;
    } catch {
      throw new Error(
        `Failed to load file ${filePath} using unstructured loader.`
      );
    }
  }
}
