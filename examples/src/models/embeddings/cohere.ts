import { CohereEmbeddings } from "langchain/embeddings/cohere";

export const run = async () => {
  /* Embed queries */
  const embeddings = new CohereEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  console.log(res);
  /* Embed documents */
  const documentRes = await embeddings.embedDocuments([
    "Hello world",
    "Bye bye",
  ]);
  console.log({ documentRes });
};
