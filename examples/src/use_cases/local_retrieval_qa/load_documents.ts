import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import { HuggingFaceTransformersEmbeddings } from "langchain/embeddings/hf_transformers";

const loader = new CheerioWebBaseLoader(
  "https://lilianweng.github.io/posts/2023-06-23-agent/"
);
const docs = await loader.load();

const splitter = new RecursiveCharacterTextSplitter({
  chunkOverlap: 0,
  chunkSize: 500,
});

const splitDocuments = await splitter.splitDocuments(docs);

const vectorstore = await HNSWLib.fromDocuments(
  splitDocuments,
  new HuggingFaceTransformersEmbeddings()
);

const retrievedDocs = await vectorstore.similaritySearch(
  "What are the approaches to Task Decomposition?"
);

console.log(retrievedDocs[0]);

/*
  Document {
    pageContent: 'Task decomposition can be done (1) by LLM with simple prompting like "Steps for XYZ.\\n1.", "What are the subgoals for achieving XYZ?", (2) by using task-specific instructions; e.g. "Write a story outline." for writing a novel, or (3) with human inputs.',
    metadata: {
      source: 'https://lilianweng.github.io/posts/2023-06-23-agent/',
      loc: { lines: [Object] }
    }
  }
*/
