import type { Client } from "@libsql/client";
import { VectorStore } from "@langchain/core/vectorstores";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";

export interface LibSQLVectorStoreArgs {
  tableName?: string;
  embeddingField?: string;
}

export class LibSQLVectorStore extends VectorStore {
  declare FilterType: (doc: Document) => boolean;

  private db;

  private tableName: string;

  private embeddingField: string;

  _vectorstoreType(): string {
    return "libsql";
  }

  constructor(
    db: Client,
    embeddings: EmbeddingsInterface,
    options: LibSQLVectorStoreArgs = {
      tableName: "vectors",
      embeddingField: "embedding",
    }
  ) {
    super(embeddings, options);

    this.db = db;
    this.tableName = options.tableName || "vectors";
    this.embeddingField = options.embeddingField || "embedding";

    this.initializeTable();
  }

  private async initializeTable() {
    await this.db.batch([
      `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        metadata TEXT,
        ${this.embeddingField} FLOAT32
      );
      `,
      `CREATE INDEX IF NOT EXISTS ${this.tableName}_idx ON ${this.tableName} (libsql_vector_idx(${this.embeddingField}));`,
    ]);
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    const embeddings = await this.embeddings.embedDocuments(texts);

    return this.addVectors(embeddings, documents);
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const rows = vectors.map((embedding, idx) => ({
      content: documents[idx].pageContent,
      embedding: `[${embedding.join(",")}]`,
      metadata: JSON.stringify(documents[idx].metadata),
    }));

    const batchSize = 100;

    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize).map((row) => ({
        sql: `INSERT INTO ${this.tableName} (content, metadata, ${this.embeddingField}) VALUES (?, ?, vector(?))`,
        args: [row.content, row.metadata, row.embedding],
      }));

      await this.db.batch(chunk);
    }
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]> {
    const queryVector = `[${query.join(",")}]`;

    const sql = `
      SELECT content, metadata, vector_distance_cos(${this.embeddingField}, vector(?)) AS distance
      FROM vector_top_k('${this.tableName}_idx', vector(?), ?)
      JOIN ${this.tableName} ON ${this.tableName}.rowid = id
    `;

    const results = await this.db.execute({
      sql,
      args: [queryVector, queryVector, k],
    });

    return results.rows.map((row: any) => {
      const metadata = JSON.parse(row.metadata);

      const doc = new Document({
        metadata,
        pageContent: row.content,
      });

      return [doc, row.distance];
    });
  }

  async delete(params: { ids?: string[] | number[] }): Promise<void> {
    if (!params.ids) {
      await this.db.execute(`DELETE FROM ${this.tableName}`);
      return;
    }

    const idsToDelete = params.ids.join(", ");

    await this.db.execute({
      sql: `DELETE FROM ${this.tableName} WHERE id IN (?)`,
      args: [idsToDelete],
    });
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    dbClient: Client,
    options?: LibSQLVectorStoreArgs
  ): Promise<LibSQLVectorStore> {
    const docs = texts.map((text, i) => {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;

      return new Document({ pageContent: text, metadata });
    });

    return LibSQLVectorStore.fromDocuments(docs, embeddings, dbClient, options);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    dbClient: Client,
    options?: LibSQLVectorStoreArgs
  ): Promise<LibSQLVectorStore> {
    const instance = new this(embeddings, dbClient, options);

    await instance.addDocuments(docs);

    return instance;
  }
}
