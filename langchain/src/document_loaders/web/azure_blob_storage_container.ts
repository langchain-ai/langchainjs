import { BlobServiceClient } from "@azure/storage-blob";
import { AzureBlobStorageFileLoader } from "./azure_blob_storage_file.js";
import { BaseDocumentLoader } from "../base.js";
import { Document } from "../../document.js";
import { UnstructuredLoaderOptions } from "../fs/unstructured.js";

export class AzureBlobStorageContainerLoader extends BaseDocumentLoader {
  private readonly connStr: string;

  private readonly container: string;

  private readonly unstructuredLoaderOptions: UnstructuredLoaderOptions;

  constructor(
    connStr: string,
    container: string,
    unstructuredLoaderOptions: UnstructuredLoaderOptions
  ) {
    super();
    this.connStr = connStr;
    this.container = container;
    this.unstructuredLoaderOptions = unstructuredLoaderOptions;
  }

  public async load() {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      this.connStr
    );

    const containerClient = blobServiceClient.getContainerClient(
      this.container
    );

    let docs: Document[] = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      const loader = new AzureBlobStorageFileLoader(
        this.connStr,
        this.container,
        blob.name,
        this.unstructuredLoaderOptions
      );
      docs = docs.concat(await loader.load());
    }

    return docs;
  }
}
