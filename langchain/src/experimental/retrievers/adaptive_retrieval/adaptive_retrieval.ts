import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import { DocumentInterface } from "@langchain/core/documents";
import {
  VectorStore,
  VectorStoreRetriever,
  VectorStoreRetrieverInput,
} from "@langchain/core/vectorstores";

/**
 * Type for options when adding a document to the VectorStore.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AddDocumentOptions = Record<string, any>;

export interface AdaptiveRetrievalFields<
  Store extends VectorStore = VectorStore
> extends Omit<VectorStoreRetrieverInput<Store>, "vectorStore"> {
  /**
   * The vector store using the larger embeddings model.
   */
  largeStore: Store;
  /**
   * The vector store using the smaller embeddings model.
   */
  smallStore: Store;
  /**
   * The number of documents to retrieve from the small store.
   *
   * @default 20
   */
  smallK?: number;
  /**
   * The number of documents to retrieve from the large store.
   *
   * @default 5
   */
  largeK?: number;
  /**
   * Optionally override the ID key used to filter the large store
   * results.
   *
   * @default "id"
   */
  idKey?: string;
}

/**
 * A retriever that uses two stores, a large and small (dictated by their dimensions)
 * to retrieve documents.
 *
 * Based off of the "Matryoshka embeddings: faster OpenAI vector search using Adaptive Retrieval"
 * blog post {@link https://supabase.com/blog/matryoshka-embeddings}.
 *
 * The AdaptiveRetrieval retriever performs two semantic searches. The first uses the smaller
 * store which returns many results, but is less accurate. Then, using the documents returned
 * from the smaller store, the larger store is used to perform a more accurate search over the
 * smaller set of documents.
 *
 * The vector store must contain an `id` field in the metadata of each document. This is used to
 * filter the results from the large store. You may override this metadata key by passing a
 * custom `idKey` to the constructor.
 */
export class AdaptiveRetrieval<
  Store extends VectorStore = VectorStore
> extends VectorStoreRetriever<Store> {
  largeStore: Store;

  smallK = 20;

  largeK = 5;

  idKey = "id";

  constructor(fields: AdaptiveRetrievalFields<Store>) {
    super({
      ...fields,
      vectorStore: fields.smallStore,
    });
    this.largeStore = fields.largeStore;
    this.smallK = fields.smallK ?? this.smallK;
    this.largeK = fields.largeK ?? this.largeK;
    this.idKey = fields.idKey ?? this.idKey;
  }

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<DocumentInterface[]> {
    const smallResults = await this.vectorStore.similaritySearch(
      query,
      this.smallK,
      this.filter,
      runManager?.getChild("small-search")
    );
    const smallResultIds = smallResults.map(
      (result) => result.metadata[this.idKey]
    );
    const largeResults = await this.largeStore.similaritySearch(
      query,
      this.largeK,
      (doc: DocumentInterface) =>
        smallResultIds.includes(doc.metadata[this.idKey]),
      runManager?.getChild("large-search")
    );

    return largeResults;
  }

  /**
   * Override the default `addDocuments` method to add documents to both the
   * large and small stores.
   */
  override addDocuments = async (
    documents: DocumentInterface[],
    options?: AddDocumentOptions
  ): Promise<void> => {
    // Insure documents contain the proper metadata ID key
    if (documents.some((doc) => !(this.idKey in doc.metadata))) {
      throw new Error(
        `All documents must contain the ID key: ${this.idKey} in their metadata.`
      );
    }
    await Promise.all([
      this.vectorStore.addDocuments(documents, options),
      this.largeStore.addDocuments(documents, options),
    ]);
  };
}
