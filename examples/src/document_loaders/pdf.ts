import { PDFLoader } from "langchain/document_loaders/fs/pdf";

export const run = async () => {
  const loader = new PDFLoader("src/document_loaders/example_data/bitcoin.pdf");

  const docs = await loader.load();

  console.log({ docs });
};
