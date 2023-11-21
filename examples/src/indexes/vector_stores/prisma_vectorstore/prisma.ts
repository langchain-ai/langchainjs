import { PrismaVectorStore } from "langchain/vectorstores/prisma";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { PrismaClient, Prisma, Document } from "@prisma/client";

export const run = async () => {
  const db = new PrismaClient();

  // Use the `withModel` method to get proper type hints for `metadata` field:
  const vectorStore = PrismaVectorStore.withModel<Document>(db).create(
    new OpenAIEmbeddings(),
    {
      prisma: Prisma,
      tableName: "Document",
      vectorColumnName: "vector",
      columns: {
        id: PrismaVectorStore.IdColumn,
        content: PrismaVectorStore.ContentColumn,
      },
    }
  );

  const texts = ["Hello world", "Bye bye", "What's this?"];
  await vectorStore.addModels(
    await db.$transaction(
      texts.map((content) => db.document.create({ data: { content } }))
    )
  );

  const resultOne = await vectorStore.similaritySearch("Hello world", 1);
  console.log(resultOne);

  // create an instance with default filter
  const vectorStore2 = PrismaVectorStore.withModel<Document>(db).create(
    new OpenAIEmbeddings(),
    {
      prisma: Prisma,
      tableName: "Document",
      vectorColumnName: "vector",
      columns: {
        id: PrismaVectorStore.IdColumn,
        content: PrismaVectorStore.ContentColumn,
      },
      filter: {
        content: {
          equals: "default",
        },
      },
    }
  );

  await vectorStore2.addModels(
    await db.$transaction(
      texts.map((content) => db.document.create({ data: { content } }))
    )
  );

  // Use the default filter a.k.a {"content": "default"}
  const resultTwo = await vectorStore.similaritySearch("Hello world", 1);
  console.log(resultTwo);
};
