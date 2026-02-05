import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { connect } from "@lancedb/lancedb";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import os from "node:os";

//
//  You can open a LanceDB dataset created elsewhere, such as LangChain Python, by opening
//     an existing table
//
export const run = async () => {
  const uri = await createdTestDb();
  const db = await connect(uri);
  const table = await db.openTable("vectors");

  const vectorStore = new LanceDB(new OpenAIEmbeddings(), { table });

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  console.log(resultOne);
  // [ Document { pageContent: 'Hello world', metadata: { id: 1 } } ]
};

async function createdTestDb(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lancedb-"));
  const db = await connect(dir);
  await db.createTable("vectors", [
    { vector: Array(1536), text: "Hello world", id: 1 },
    { vector: Array(1536), text: "Bye bye", id: 2 },
    { vector: Array(1536), text: "hello nice world", id: 3 },
  ]);
  return dir;
}
