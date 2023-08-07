import { BlobServiceClient } from "@azure/storage-blob";
import { AzureBlobStorageFileLoader } from "./azure_blob_storage_file.js";
import { BaseDocumentLoader } from "../base.js";
import { Document } from "../../document.js";
import { UnstructuredLoaderOptions } from "../fs/unstructured.js";

interface AzureBlobStorageContainerConfig {
  connectionString: string;
  container: string;
}

interface AzureBlobStorageContainerLoaderConfig {
  azureConfig: AzureBlobStorageContainerConfig;
  unstructuredConfig?: UnstructuredLoaderOptions;
}

export class AzureBlobStorageContainerLoader extends BaseDocumentLoader {
  private readonly connectionString: string;

  private readonly container: string;

  private readonly unstructuredConfig?: UnstructuredLoaderOptions;

  constructor({
    azureConfig,
    unstructuredConfig,
  }: AzureBlobStorageContainerLoaderConfig) {
    super();
    this.connectionString = azureConfig.connectionString;
    this.container = azureConfig.container;
    this.unstructuredConfig = unstructuredConfig;
  }

  public async load() {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      this.connectionString
    );

    const containerClient = blobServiceClient.getContainerClient(
      this.container
    );

    let docs: Document[] = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      const loader = new AzureBlobStorageFileLoader({
        azureConfig: {
          connectionString: this.connectionString,
          container: this.container,
          blobName: blob.name,
        },
        unstructuredConfig: this.unstructuredConfig,
      });
      docs = docs.concat(await loader.load());
    }

    return docs;
  }
}
