import { MinimaxEmbeddings } from "@langchain/community/embeddings/minimax";

export const run = async () => {
  /* Embed queries */
  const embeddings = new MinimaxEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  console.log(res);
  /* Embed documents */
  const documentRes = await embeddings.embedDocuments([
    "Hello world",
    "Bye bye",
  ]);
  console.log({ documentRes });
};
