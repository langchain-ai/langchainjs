import { BlobServiceClient } from "@azure/storage-blob";
import { AzureBlobStorageFileLoader } from "./azure_blob_storage_file.js";
import { BaseDocumentLoader } from "../base.js";
import { Document } from "../../document.js";

export class AzureBlobStorageContainerLoader extends BaseDocumentLoader {
    private readonly connStr: string;

    private readonly container: string;
  
    constructor(connStr: string, container: string) {
      super();
      this.connStr = connStr;
      this.container = container;
    }

    public async load() {
      const blobServiceClient = BlobServiceClient.fromConnectionString(this.connStr);
      
      const containerClient = blobServiceClient.getContainerClient(this.container);

      const docs: Document[] = []
      for await (const blob of containerClient.listBlobsFlat()) {
        const loader = new AzureBlobStorageFileLoader(this.connStr, this.container, blob.name)
        docs.concat(await loader.load())
    }

    return docs;
  }
}
