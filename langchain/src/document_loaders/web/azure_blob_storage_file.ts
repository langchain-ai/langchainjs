import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { BlobServiceClient } from "@azure/storage-blob";
import { BaseDocumentLoader } from "../base.js";
import { UnstructuredLoader } from "../fs/unstructured.js";

export class AzureBlobStorageFileLoader extends BaseDocumentLoader {
  private readonly connStr: string;

  private readonly container: string;

  private readonly blobName: string;

  constructor(connStr: string, container: string, blobName: string) {
    super();
    this.connStr = connStr;
    this.container = container;
    this.blobName = blobName;
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
      const unstructuredLoader = new UnstructuredLoader(filePath);

      const docs = await unstructuredLoader.load();

      return docs;
    } catch {
      throw new Error(
        `Failed to load file ${filePath} using unstructured loader.`
      );
    }
  }
}
