import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { connect } from "vectordb";

// Create docs with a loader
const loader = new TextLoader("src/document_loaders/example_data/example.txt");
const docs = await loader.load();

export const run = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lancedb-"));
  const db = await connect(dir);
  const table = await db.createTable("vectors", [
    { vector: Array(1536), text: "sample", source: "a" },
  ]);

  const vectorStore = await LanceDB.fromDocuments(
    docs,
    new OpenAIEmbeddings(),
    { table }
  );

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  console.log(resultOne);

  // [
  //   Document {
  //     pageContent: 'Foo\nBar\nBaz\n\n',
  //     metadata: { source: 'src/document_loaders/example_data/example.txt' }
  //   }
  // ]
};
