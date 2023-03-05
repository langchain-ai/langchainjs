import { PGVectorClient } from "langchain/vectorstores";
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
    await this.client.from("documents").upsert(
      vectors.map((embedding, idx) => ({
        content: documents[idx],
        embedding: JSON.stringify(embedding),
      }))
    );
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number
  ): Promise<[Document, number][]> {
    // todo pass through?
    const match_count = 10;

    // todo try for error?
    const res = await this
      .client`SELECT match_documents ('[${query}]',${k},${match_count})`;

    // how to parse this mess
    // [ [ '(1,"Hello world",1)' ], [ '(2,"Bye bye",0.827041000018841)' ] ]
    // console.log(res);

    const result: [Document, number][] = res.rows.map((resp: any) => {
      //   console.log(typeof resp.match_documents);

      const obj = JSON.parse(resp.content);

      return [
        new Document({
          metadata: obj.metadata ?? ({} as Record<string, any>),
          pageContent: obj.pageContent,
        }),
        resp.similarity,
      ];
    });

    // console.log(result);
    return result;
  }

  // can't run raw sql with supabase api, so you need to manually set up in dashboard
  async prepare() {
    const dropAndCreate = [
      "DROP TABLE IF EXISTS documents;",
      "DROP FUNCTION IF EXISTS match_documents;",
      "DROP EXTENSION IF EXISTS vector;",
      "create extension vector;",
      `create table documents (
    id bigserial primary key,
    content text,
    embedding vector (1536)
    );`,
      `create or replace function match_documents (
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
    $$;`,
      `create index on documents
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);`,
    ];
    for (const statement of dropAndCreate) {
      const res = await this.client`${statement}`;
      console.log("asdfasdfasdf", res);
    }
  }
}
