import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export const run = async () => {
  /* load raw docs from the all files in the directory */
  const directoryLoader = new DirectoryLoader(
    "src/document_loaders/example_data/",
    {
      ".pdf": (path: string) => new PDFLoader(path),
    }
  );

  const documents = await directoryLoader.load();

  console.log({ documents });

  /* Additionnal steps : Split text into chunks */
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const splittedDocuments = await textSplitter.splitDocuments(documents);
  console.log({ splittedDocuments });
};
