import { PrismaVectorStore } from "@langchain/community/vectorstores/prisma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PrismaClient, Prisma, Document } from "@prisma/client";

// Example demonstrating PrismaVectorStore with UUID columns
//
// This example assumes you have a Prisma schema with UUID fields:
//
// model Document {
//   id        String                 @id @default(uuid()) @db.Uuid
//   content   String
//   namespace String?                @default("default")
//   vector    Unsupported("vector")?
// }

export const run = async () => {
  const db = new PrismaClient();

  // Use the `withModel` method to get proper type hints for `metadata` field
  // and specify columnTypes for UUID columns
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
      // Specify column types for proper SQL casting
      columnTypes: {
        id: "uuid", // This tells PrismaVectorStore to cast the id column as UUID
      },
    }
  );

  const texts = ["Hello world", "Bye bye", "What's this?"];

  // Create documents with UUID ids
  await vectorStore.addModels(
    await db.$transaction(
      texts.map((content) => db.document.create({ data: { content } }))
    )
  );

  // Similarity search will work correctly with UUID columns
  const resultOne = await vectorStore.similaritySearch("Hello world", 1);
  console.log(resultOne);

  // You can also use filters with UUID columns
  const someUuid = "123e4567-e89b-12d3-a456-426614174000";
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
      columnTypes: {
        id: "uuid",
      },
      filter: {
        id: {
          equals: someUuid, // This will be properly cast to UUID in SQL
        },
      },
    }
  );

  // Using IN operator with multiple UUIDs
  const vectorStore3 = PrismaVectorStore.withModel<Document>(db).create(
    new OpenAIEmbeddings(),
    {
      prisma: Prisma,
      tableName: "Document",
      vectorColumnName: "vector",
      columns: {
        id: PrismaVectorStore.IdColumn,
        content: PrismaVectorStore.ContentColumn,
      },
      columnTypes: {
        id: "uuid",
      },
      filter: {
        id: {
          in: [
            "123e4567-e89b-12d3-a456-426614174000",
            "223e4567-e89b-12d3-a456-426614174001",
          ], // These will be properly cast to UUID[] in SQL
        },
      },
    }
  );

  // The columnTypes configuration supports multiple types:
  // - "uuid": For UUID columns (@db.Uuid in Prisma schema)
  // - "integer": For integer columns
  // - "bigint": For bigint columns
  // - "jsonb": For JSONB columns
  // - "text": For text columns (default behavior)
};
