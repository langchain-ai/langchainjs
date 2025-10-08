import { GoogleCloudStorageLoader } from "@langchain/community/document_loaders/web/google_cloud_storage";

const loader = new GoogleCloudStorageLoader({
  bucket: "my-bucket-123",
  file: "path/to/file.pdf",
  storageOptions: {
    keyFilename: "/path/to/keyfile.json",
  },
  unstructuredLoaderOptions: {
    apiUrl: "http://localhost:8000/general/v0/general",
    apiKey: "", // this will be soon required
  },
});

const docs = await loader.load();

console.log(docs);
