import { AzureBlobStorageContainerLoader } from "langchain/document_loaders/web/azure_blob_storage_container";

const loader = new AzureBlobStorageContainerLoader(
  {
    connectionString: "",
    container: "container_name",
  },
  {
    apiUrl: "http://localhost:8000/general/v0/general",
    apiKey: "", // this will be soon required
  }
);

const docs = await loader.load();

console.log(docs);
