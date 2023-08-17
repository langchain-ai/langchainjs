import { Document } from "langchain/document";
import { CharacterTextSplitter } from "langchain/text_splitter";

export const run = async () => {
  /* Split text */
  const text = "foo bar baz 123";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 7,
    chunkOverlap: 3,
  });
  const output = await splitter.createDocuments([text]);
  console.log({ output });
  /* Split documents */
  const docOutput = await splitter.splitDocuments([
    new Document({ pageContent: text }),
  ]);
  console.log({ docOutput });
};
