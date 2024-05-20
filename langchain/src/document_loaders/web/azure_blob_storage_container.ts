import { BlobServiceClient } from "@azure/storage-blob";
import { Document } from "@langchain/core/documents";
import { AzureBlobStorageFileLoader } from "./azure_blob_storage_file.js";
import { BaseDocumentLoader } from "../base.js";
import { UnstructuredLoaderOptions } from "../fs/unstructured.js";
import { logVersion020MigrationWarning } from "../../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion020MigrationWarning({
  oldEntrypointName: "document_loaders/web/azure_blog_storage_container",
  newPackageName: "@langchain/community",
});

/**
 * Interface representing the configuration for accessing an Azure Blob
 * Storage container. It includes properties for the connection string and
 * container name.
 */
interface AzureBlobStorageContainerConfig {
  connectionString: string;
  container: string;
}

/**
 * Interface representing the configuration for the
 * AzureBlobStorageContainerLoader. It includes properties for the
 * azureConfig and unstructuredConfig. The azureConfig property contains
 * the Azure Blob Storage container configuration, and the
 * unstructuredConfig property contains the options for the
 * UnstructuredLoader.
 */
interface AzureBlobStorageContainerLoaderConfig {
  azureConfig: AzureBlobStorageContainerConfig;
  unstructuredConfig?: UnstructuredLoaderOptions;
}

/**
 * @deprecated - Import from "@langchain/community/document_loaders/web/azure_blog_storage_container" instead. This entrypoint will be removed in 0.3.0.
 * Class representing a document loader that loads documents from an Azure
 * Blob Storage container. It extends the BaseDocumentLoader class.
 */
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

  /**
   * Method to load documents from an Azure Blob Storage container. It
   * creates a BlobServiceClient using the connection string, gets the
   * container client using the container name, and iterates over the blobs
   * in the container. For each blob, it creates an instance of
   * AzureBlobStorageFileLoader and loads the documents using the loader.
   * The loaded documents are concatenated to the docs array and returned.
   * @returns An array of loaded documents.
   */
  public async load() {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      this.connectionString,
      {
        userAgentOptions: {
          userAgentPrefix: "langchainjs-blob-storage-container",
        },
      }
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
