import { BaseClient } from "@xata.io/client";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

export interface XataClientArgs<XataClient> {
  readonly client: XataClient;
  readonly table: string;
}

type XataFilter = object;

export class XataVectorSearch<
  XataClient extends BaseClient
> extends VectorStore {
  declare FilterType: XataFilter;

  private readonly client: XataClient;

  private readonly table: string;

  _vectorstoreType(): string {
    return "xata";
  }

  constructor(embeddings: Embeddings, args: XataClientArgs<XataClient>) {
    super(embeddings, args);

    this.client = args.client;
    this.table = args.table;
  }

  async addDocuments(documents: Document[], options?: { ids?: string[] }) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] }
  ) {
    const rows = vectors
      .map((embedding, idx) => ({
        content: documents[idx].pageContent,
        embedding,
        ...documents[idx].metadata,
      }))
      .map((row, idx) => {
        if (options?.ids) {
          return { id: options.ids[idx], ...row };
        }
        return row;
      });

    const res = await this.client.db[this.table].createOrReplace(rows);
    // Since we have an untyped BaseClient, it doesn't know the
    // actual return type of the overload.
    const results = res as unknown as { id: string }[];
    const returnedIds = results.map((row) => row.id);
    return returnedIds;
  }

  async delete(params: { ids: string[] }): Promise<void> {
    const { ids } = params;
    await this.client.db[this.table].delete(ids);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: XataFilter | undefined
  ): Promise<[Document, number][]> {
    const records = await this.client.db[this.table].vectorSearch(
      "embedding",
      query,
      {
        size: k,
        filter,
      }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return records.map((record: any) => [
      new Document({
        pageContent: record.content,
        metadata: Object.fromEntries(
          Object.entries(record).filter(
            ([key]) =>
              key !== "content" &&
              key !== "embedding" &&
              key !== "xata" &&
              key !== "id"
          )
        ),
      }),
      record.xata.score,
    ]);
  }
}
