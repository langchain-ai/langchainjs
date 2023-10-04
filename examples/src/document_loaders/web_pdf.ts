import { WebPDFLoader } from "langchain/document_loaders/web/pdf";

const blob = new Blob(); // e.g. from a file input

const loader = new WebPDFLoader(blob);

const docs = await loader.load();

console.log({ docs });
