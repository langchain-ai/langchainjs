import { S3Loader } from "langchain/document_loaders/web/s3";

const loader = new S3Loader({
  bucket: "my-document-bucket-123",
  key: "AccountingOverview.pdf",
  s3Config: {
    region: "us-east-1",
    credentials: {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    },
  },
  unstructuredAPIURL: "http://localhost:8000/general/v0/general",
  unstructuredAPIKey: "", // this will be soon required
});

const docs = await loader.load();

console.log(docs);
