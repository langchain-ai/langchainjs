import { OpenAIEmbeddings, CohereEmbeddings } from "langchain/embeddings";

export const run = async () => {
  /* OpenAI Embeddings */
  /* Embed queries */
  const openAIEmbeddings = new OpenAIEmbeddings();
  const openaiResponse = await openAIEmbeddings.embedQuery("Hello world");
  console.log(openaiResponse);
  /* Embed documents */
  const openaiDocumentResponse = await openAIEmbeddings.embedDocuments([
    "Hello world",
    "Bye bye",
  ]);
  console.log({ openaiDocumentResponse });

  /* Cohere Embeddings */
  /* Embed queries */
  const cohereEmbeddings = new CohereEmbeddings();
  const cohereResponse = await cohereEmbeddings.embedQuery("Hello world");
  console.log(cohereResponse);
  /* Embed documents */
  const cohereDocumentResponse = await cohereEmbeddings.embedDocuments([
    "Hello world",
    "Bye bye",
  ]);
  console.log({ cohereDocumentResponse });
};
