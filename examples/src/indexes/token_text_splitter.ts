import { Document } from "langchain/document";
import { TokenTextSplitter } from "langchain/text_splitter";
import fs from "fs";
import path from "path";

export const run = async () => {
  /* Split text */
  const text = fs.readFileSync(
    path.resolve(__dirname, "../../state_of_the_union.txt"),
    "utf8"
  );

  const splitter = new TokenTextSplitter({
    encodingName: "r50k_base",
    chunkSize: 10,
    chunkOverlap: 0,
    allowedSpecial: ["<|endoftext|>"],
    disallowedSpecial: [],
  });

  const output = splitter.createDocuments([text]);
  console.log({ output });

  const docOutput = splitter.splitDocuments([
    new Document({ pageContent: text }),
  ]);

  console.log({ docOutput });
};
