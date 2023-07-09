import { GooglePalmEmbeddings } from "langchain/embeddings/googlepalm";

export const run = async () => {
  const model = new GooglePalmEmbeddings();
  /* Embed queries */
  const res = await model.embedQuery(
    "What would be a good company name for a company that makes colorful socks?"
  );
  console.log({ res });
  /* Embed documents */
  const documentRes = await model.embedDocuments(["Hello world", "Bye bye"]);
  console.log({ documentRes });
};
