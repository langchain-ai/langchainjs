import { BaseClient } from "@xata.io/client";
import { Embeddings } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

/**
 * Interface for the arguments required to create a XataClient. Includes
 * the client instance and the table name.
 */
export interface XataClientArgs<XataClient> {
  readonly client: XataClient;
  readonly table: string;
}

/**
 * Type for the filter object used in Xata database queries.
 */
type XataFilter = object;

/**
 * Class for interacting with a Xata database as a VectorStore. Provides
 * methods to add documents and vectors to the database, delete entries,
 * and perform similarity searches.
 */
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

  /**
   * Method to add documents to the Xata database. Maps the page content of
   * each document, embeds the documents using the embeddings, and adds the
   * vectors to the database.
   * @param documents Array of documents to be added.
   * @param options Optional object containing an array of ids.
   * @returns Promise resolving to an array of ids of the added documents.
   */
  async addDocuments(documents: Document[], options?: { ids?: string[] }) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      options
    );
  }

  /**
   * Method to add vectors to the Xata database. Maps each vector to a row
   * with the document's content, embedding, and metadata. Creates or
   * replaces these rows in the Xata database.
   * @param vectors Array of vectors to be added.
   * @param documents Array of documents corresponding to the vectors.
   * @param options Optional object containing an array of ids.
   * @returns Promise resolving to an array of ids of the added vectors.
   */
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

  /**
   * Method to delete entries from the Xata database. Deletes the entries
   * with the provided ids.
   * @param params Object containing an array of ids of the entries to be deleted.
   * @returns Promise resolving to void.
   */
  async delete(params: { ids: string[] }): Promise<void> {
    const { ids } = params;
    await this.client.db[this.table].delete(ids);
  }

  /**
   * Method to perform a similarity search in the Xata database. Returns the
   * k most similar documents along with their scores.
   * @param query Query vector for the similarity search.
   * @param k Number of most similar documents to return.
   * @param filter Optional filter for the search.
   * @returns Promise resolving to an array of tuples, each containing a Document and its score.
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: XataFilter | undefined
  ): Promise<[Document, number][]> {
    const { records } = await this.client.db[this.table].vectorSearch(
      "embedding",
      query,
      {
        size: k,
        filter,
      }
    );

    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      records?.map((record: any) => [
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
      ]) ?? []
    );
  }
}
