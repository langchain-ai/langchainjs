import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { BlobServiceClient } from "@azure/storage-blob";
import { BaseDocumentLoader } from "../base.js";
import {
  UnstructuredLoader,
  UnstructuredLoaderOptions,
} from "../fs/unstructured.js";

interface AzureBlobStorageFileConfig {
  connectionString: string;
  container: string;
  blobName: string;
}

interface AzureBlobStorageFileLoaderConfig {
  azureConfig: AzureBlobStorageFileConfig;
  unstructuredConfig?: UnstructuredLoaderOptions;
}

export class AzureBlobStorageFileLoader extends BaseDocumentLoader {
  private readonly connectionString: string;

  private readonly container: string;

  private readonly blobName: string;

  private readonly unstructuredConfig?: UnstructuredLoaderOptions;

  constructor({
    azureConfig,
    unstructuredConfig,
  }: AzureBlobStorageFileLoaderConfig) {
    super();
    this.connectionString = azureConfig.connectionString;
    this.container = azureConfig.container;
    this.blobName = azureConfig.blobName;
    this.unstructuredConfig = unstructuredConfig;
  }

  public async load() {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "azureblobfileloader-")
    );

    const filePath = path.join(tempDir, this.blobName);

    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(
        this.connectionString
      );

      const containerClient = blobServiceClient.getContainerClient(
        this.container
      );

      const blobClient = containerClient.getBlobClient(this.blobName);

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      await blobClient.downloadToFile(filePath);
    } catch (e: unknown) {
      throw new Error(
        `Failed to download file ${
          this.blobName
        } from Azure Blob Storage container ${this.container}: ${
          (e as Error).message
        }`
      );
    }

    try {
      const unstructuredLoader = new UnstructuredLoader(
        filePath,
        this.unstructuredConfig
      );

      const docs = await unstructuredLoader.load();
      return docs;
    } catch {
      throw new Error(
        `Failed to load file ${filePath} using unstructured loader.`
      );
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  }
}
