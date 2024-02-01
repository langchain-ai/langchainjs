import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import type { VectorStoreInterface } from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";
import { BaseStore, type BaseStoreInterface } from "@langchain/core/stores";
import { createDocumentStoreFromByteStore } from "../storage/encoder_backed.js";

/**
 * Arguments for the MultiVectorRetriever class.
 */
export interface MultiVectorRetrieverInput extends BaseRetrieverInput {
  vectorstore: VectorStoreInterface;
  /** @deprecated Prefer `byteStore`. */
  docstore?: BaseStoreInterface<string, Document>;
  byteStore?: BaseStore<string, Uint8Array>;
  idKey?: string;
  childK?: number;
  parentK?: number;
}

/**
 * A retriever that retrieves documents from a vector store and a document
 * store. It uses the vector store to find relevant documents based on a
 * query, and then retrieves the full documents from the document store.
 * @example
 * ```typescript
 * const retriever = new MultiVectorRetriever({
 *   vectorstore: new FaissStore(),
 *   byteStore: new InMemoryStore<Unit8Array>(),
 *   idKey: "doc_id",
 *   childK: 20,
 *   parentK: 5,
 * });
 *
 * const retrieverResult = await retriever.getRelevantDocuments("justice breyer");
 * console.log(retrieverResult[0].pageContent.length);
 * ```
 */
export class MultiVectorRetriever extends BaseRetriever {
  static lc_name() {
    return "MultiVectorRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "multi_vector"];

  public vectorstore: VectorStoreInterface;

  public docstore: BaseStoreInterface<string, Document>;

  protected idKey: string;

  protected childK?: number;

  protected parentK?: number;

  constructor(args: MultiVectorRetrieverInput) {
    super(args);
    this.vectorstore = args.vectorstore;
    if (args.byteStore) {
      this.docstore = createDocumentStoreFromByteStore(args.byteStore);
    } else if (args.docstore) {
      this.docstore = args.docstore;
    } else {
      throw new Error(
        "byteStore and docstore are undefined. Please provide at least one."
      );
    }
    this.idKey = args.idKey ?? "doc_id";
    this.childK = args.childK;
    this.parentK = args.parentK;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const subDocs = await this.vectorstore.similaritySearch(query, this.childK);
    const ids: string[] = [];
    for (const doc of subDocs) {
      if (doc.metadata[this.idKey] && !ids.includes(doc.metadata[this.idKey])) {
        ids.push(doc.metadata[this.idKey]);
      }
    }
    const docs = await this.docstore.mget(ids);
    return docs
      .filter((doc) => doc !== undefined)
      .slice(0, this.parentK) as Document[];
  }
}
