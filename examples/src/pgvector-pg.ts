// import postgres from "postgres";
// import {  PGClient } from "langchain/vectorstores";


// export class PostgresClient implements PGClient {
//     client: any;
  
//     constructor(client: any) {
//       this.client = client;
//     }
  
//     addVectors(
//       vectors: number[][],
//       documents: Document[],
//       _ids?: string[]
//     ): Promise<void>{
  
//       this.client
  
//     }
  
//       // Promise<[Document, number][]>
//     async similaritySearchVectorWithScore(query: number[],
//       k: number
//     ): Promise<[Document, number][]>{ 
  
//       console.log(`SELECT ${this.queryName}('[${query}]',${k},${match_count})`);
  
//       const res = await this
//         .client`SELECT ${this.queryName}('[${query}]',${k},${match_count})`;
  
//       // how to parse this mess
//       // [ [ '(1,"Hello world",1)' ], [ '(2,"Bye bye",0.827041000018841)' ] ]
//       console.log(res);
  
//       const result: [Document, number][] = res.rows.map((resp: any) => {
//         console.log(typeof resp.match_documents);
  
//         return [
//           new Document({
//             metadata: {}, // todo
//             pageContent: resp.content,
//           }),
//           resp.similarity,
//         ];
//     }
    
//     prepare(){
  
//       static dropAndCreate = `
//       DROP TABLE IF EXISTS documents;
//       DROP FUNCTION IF EXISTS match_documents;
//       DROP EXTENSION IF EXISTS vector;
      
//       create extension vector;
      
//       create table documents (
//        id bigserial primary key,
//        content text,
//        embedding vector (1536)
//       );
      
//       create or replace function match_documents (
//        query_embedding vector(1536),
//        similarity_threshold float,
//        match_count int
//       )
//       returns table (
//        id bigint,
//        content text,
//        similarity float
//       )
//       language plpgsql
//       as $$
//       #variable_conflict use_column
//       begin
//        return query
//        select
//          id,
//          content,
//          1 - (documents.embedding <=> query_embedding) as similarity
//        from documents
//        where 1 - (documents.embedding <=> query_embedding) > similarity_threshold
//        order by documents.embedding <=> query_embedding
//        limit match_count;
//       end;
//       $$;
      
//       create index on documents
//       using ivfflat (embedding vector_cosine_ops)
//       with (lists = 100);`;
//     }
//   }
    
  