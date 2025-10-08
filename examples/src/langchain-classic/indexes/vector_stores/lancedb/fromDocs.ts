import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Create docs with a loader
const loader = new TextLoader("src/document_loaders/example_data/example.txt");
const docs = await loader.load();

export const run = async () => {
  const vectorStore = await LanceDB.fromDocuments(docs, new OpenAIEmbeddings());

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  console.log(resultOne);

  // [
  //   Document {
  //     pageContent: 'Foo\nBar\nBaz\n\n',
  //     metadata: { source: 'src/document_loaders/example_data/example.txt' }
  //   }
  // ]
};

export const run_with_existing_table = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lancedb-"));

  const vectorStore = await LanceDB.fromDocuments(docs, new OpenAIEmbeddings());

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  console.log(resultOne);

  // [
  //   Document {
  //     pageContent: 'Foo\nBar\nBaz\n\n',
  //     metadata: { source: 'src/document_loaders/example_data/example.txt' }
  //   }
  // ]
};
