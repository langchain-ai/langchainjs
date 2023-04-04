import { S3Loader } from "langchain/document_loaders";

const loader = new S3Loader(
  "my-document-bucket-123",
  "AccountingOverview.pdf",
  "http://localhost:8000/general/v0/general"
);

const docs = await loader.load();

console.log(docs);
