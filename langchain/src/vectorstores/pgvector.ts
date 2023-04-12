import type { Client } from "pg";
import * as pgvector from "pgvector/pg";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

interface SearchEmbeddingsParams {
  query_embedding: number[];
  match_count: number; // int
}

export interface SearchEmbeddingsResponse {
  id: number;
  content: string;
  metadata: object;
  similarity: number;
}

export interface PGVectorLibArgs {
  client: Client;
  tableName?: string;
  queryName?: string;
}

export class PGVectorStore extends VectorStore {
  client: Client;

  tableName: string;

  queryName: string;

  constructor(embeddings: Embeddings, args: PGVectorLibArgs) {
    super(embeddings, args);

    this.client = args.client;
    this.tableName = args.tableName || "documents";
    this.queryName = args.queryName || "match_documents";
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const rows = vectors.map((embedding, idx) => ({
      content: documents[idx].pageContent,
      embedding,
      metadata: documents[idx].metadata,
    }));
    await pgvector.registerType(this.client);
    await Promise.all(rows.map(r => this.client.query(
      `insert into documents (content, metadata, embedding) VALUES ($1, $2, $3)`,
      [r.content, r.metadata, pgvector.toSql(r.embedding)]
    )));
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async similaritySearchVectorWithScore(query: number[], k: number, _filter?: object | undefined): Promise<[Document, number][]> {
    const matchDocumentsParams: SearchEmbeddingsParams = {
      query_embedding: query,
      match_count: k,
    };

    const {rows} = await this.client.query(
      'select * from match_documents($1, $2)', [pgvector.toSql(matchDocumentsParams.query_embedding), matchDocumentsParams.match_count],
    );
    const result: [Document, number][] = rows.map((row: SearchEmbeddingsResponse) => [
      new Document({
        metadata: row.metadata,
        pageContent: row.content,
      }),
      row.similarity,
    ]);

    return result;
  }

  static async fromDocuments(docs: Document[], embeddings: Embeddings, dbConfig: PGVectorLibArgs): Promise<PGVectorStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

}