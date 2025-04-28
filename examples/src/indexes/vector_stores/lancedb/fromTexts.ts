import { LanceDB } from "@langchain/community/vectorstores/lancedb";
import { OpenAIEmbeddings } from "@langchain/openai";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import os from "node:os";

export const run = async () => {
  const vectorStore = await LanceDB.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  console.log(resultOne);
  // [ Document { pageContent: 'hello nice world', metadata: { id: 3 } } ]
};

export const run_with_existing_table = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lancedb-"));
  const vectorStore = await LanceDB.fromTexts(
    ["Hello world", "Bye bye", "hello nice world"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );

  const resultOne = await vectorStore.similaritySearch("hello world", 1);
  console.log(resultOne);
  // [ Document { pageContent: 'hello nice world', metadata: { id: 3 } } ]
};
