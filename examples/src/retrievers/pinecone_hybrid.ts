import { PineconeClient } from "@pinecone-database/pinecone";
import { BertWordPieceTokenizer } from "tokenizers";

import { OpenAIEmbeddings } from "langchain/embeddings";
import { PineconeHybridSearchRetriever } from "langchain/retrievers";

export const run = async () => {
  const client = new PineconeClient();

  await client.init({
    environment: process.env.PINECONE_ENVIRONMENT!,
    apiKey: process.env.PINECONE_API_KEY!,
  });

  const embeddings = new OpenAIEmbeddings();
  const pineconeIndex = client.Index(process.env.PINECONE_INDEX!);

  const tokenizer = await BertWordPieceTokenizer.fromOptions({
    lowercase: true,
  });

  const retriever = new PineconeHybridSearchRetriever(embeddings, {
    pineconeIndex,
    topK: 3,
    alpha: 0.5,
    tokenizer,
  });

  const results = await retriever.getRelevantDocuments("hello bye");

  console.log(results);
};
