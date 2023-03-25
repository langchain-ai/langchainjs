import {
  PrismaTypeContent,
  PrismaTypeId,
  PrismaVectorStore,
} from "langchain/vectorstores";
import { OpenAIEmbeddings } from "langchain/embeddings";
import {
  PrismaClient,
  Prisma,
  Document as PrismaDocument,
} from "@prisma/client";
import { Document } from "langchain/document";

export const run = async () => {
  const client = new PrismaClient();

  const vectorStore = new PrismaVectorStore<PrismaDocument, Prisma.ModelName>(
    {
      tableName: "Document",
      columns: { id: PrismaTypeId, content: PrismaTypeContent },
      vectorColumnName: "vector",
    },
    client,
    Prisma,
    new OpenAIEmbeddings()
  );

  const texts = ["Hello world", "Bye bye", "What's this?"];

  const data = await client.$transaction(async (tx) =>
    Promise.all(
      texts.map(async (content) => {
        const metadata = await tx.document.create({ data: { content } });
        return new Document({ pageContent: metadata.content, metadata });
      })
    )
  );

  await vectorStore.addDocuments(data);
  const resultOne = await vectorStore.similaritySearch("Hello world", 1);

  console.log(resultOne);
};
