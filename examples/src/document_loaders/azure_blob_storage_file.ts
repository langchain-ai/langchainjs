import { AzureBlobStorageFileLoader } from "langchain/document_loaders/web/azure_blob_storage_file";

const loader = new AzureBlobStorageFileLoader({
  azureConfig: {
    connectionString: "",
    container: "container_name",
    blobName: "example.txt",
  },
  unstructuredConfig: {
    apiUrl: "http://localhost:8000/general/v0/general",
    apiKey: "", // this will be soon required
  },
});

const docs = await loader.load();

console.log(docs);
