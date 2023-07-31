import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

export interface XataClientArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly client: any;
  readonly table: string;
}

type XataFilter = object;

export class XataVectorSearch extends VectorStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly client: any;

  private readonly table: string;

  _vectorstoreType(): string {
    return "xata";
  }

  constructor(embeddings: Embeddings, args: XataClientArgs) {
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
    // XXX: clean this up
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
