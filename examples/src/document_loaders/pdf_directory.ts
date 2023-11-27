import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

/* Load all PDFs within the specified directory */
const directoryLoader = new DirectoryLoader(
  "src/document_loaders/example_data/",
  {
    ".pdf": (path: string) => new PDFLoader(path),
  }
);

const docs = await directoryLoader.load();

console.log({ docs });

/* Additional steps : Split text into chunks with any TextSplitter. You can then use it as context or save it to memory afterwards. */
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const splitDocs = await textSplitter.splitDocuments(docs);
console.log({ splitDocs });
