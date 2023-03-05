import { PGVectorClient } from "langchain/vectorstores";
import format from "pg-format";
import { Document } from "langchain/document";

export class PGClient implements PGVectorClient {
  client: any;

  constructor(client: any) {
    this.client = client;
  }

  async addVectors(
    vectors: number[][],
    documents: Document[],
    _ids?: string[]
  ): Promise<void> {
    const values = vectors.map((embedding, idx) => [
      documents[idx],
      JSON.stringify(embedding),
    ]);

    // todo to check existing/ upsert, error
    await this.client.query(
      format("INSERT INTO documents (content, embedding) VALUES %L", values)
    );
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    // todo pass through?
    const match_count = 1;

    const qry = {
      text: `SELECT match_documents ('[${query}]',${k}, ${match_count})`,
      rowMode: "array",
    };

    // todo try for error?
    const res = await this.client.query(qry);

    const result: [Document, number][] = res.rows.map((resp: any) => {
      // todo how to parse this mess
      // ['(37,"{""metadata"": {}, ""pageContent"": ""One of the most ...human traffickers.""}",0.844546079187838)']]
      console.log(resp);
      const obj = JSON.parse(resp.content);

      return [
        new Document({
          metadata: obj.metadata ?? ({} as Record<string, any>),
          pageContent: obj.pageContent,
        }),
        resp.similarity,
      ];
    });

    return result;
  }

  async prepare() {
    const dropAndCreate = `
      DROP TABLE IF EXISTS documents;
      DROP FUNCTION IF EXISTS match_documents;
      DROP EXTENSION IF EXISTS vector;
      
      create extension vector;
      
      create table documents (
       id bigserial primary key,
       content text,
       embedding vector (1536)
      );
      
      create or replace function match_documents (
       query_embedding vector(1536),
       similarity_threshold float,
       match_count int
      )
      returns table (
       id bigint,
       content text,
       similarity float
      )
      language plpgsql
      as $$
      #variable_conflict use_column
      begin
       return query
       select
         id,
         content,
         1 - (documents.embedding <=> query_embedding) as similarity
       from documents
       where 1 - (documents.embedding <=> query_embedding) > similarity_threshold
       order by documents.embedding <=> query_embedding
       limit match_count;
      end;
      $$;
      
      create index on documents
      using ivfflat (embedding vector_cosine_ops)
      with (lists = 100);`;

    await this.client.query(dropAndCreate);
  }
}
