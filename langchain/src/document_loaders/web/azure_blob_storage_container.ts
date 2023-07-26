import { BlobServiceClient } from "@azure/storage-blob";
import { AzureBlobStorageFileLoader } from "./azure_blob_storage_file.js";
import { BaseDocumentLoader } from "../base.js";
import { Document } from "../../document.js";
import { UnstructuredLoaderOptions } from "../fs/unstructured.js";

interface AzureBlobStorageContainerConfig {
  connectionString: string;
  container: string;
}

export class AzureBlobStorageContainerLoader extends BaseDocumentLoader {
  private readonly connectionString: string;

  private readonly container: string;

  private readonly unstructuredLoaderOptions?: UnstructuredLoaderOptions;

  constructor(
    { connectionString, container }: AzureBlobStorageContainerConfig,
    unstructuredLoaderOptions?: UnstructuredLoaderOptions
  ) {
    super();
    this.connectionString = connectionString;
    this.container = container;
    this.unstructuredLoaderOptions = unstructuredLoaderOptions;
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
      const loader = new AzureBlobStorageFileLoader(
        {
          connectionString: this.connectionString,
          container: this.container,
          blobName: blob.name,
        },
        this.unstructuredLoaderOptions
      );
      docs = docs.concat(await loader.load());
    }

    return docs;
  }
}
