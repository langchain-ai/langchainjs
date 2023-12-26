import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import type { VectorStoreInterface } from "@langchain/core/vectorstores";
import { DocumentInterface } from "@langchain/core/documents";
import { v4 as uuidv4 } from "uuid";
import { BaseStore, BaseStoreInterface } from "../schema/storage.js";
import { Document } from "../document.js";
import { createDocumentStoreFromByteStore } from "../storage/encoder_backed.js";

/**
 * Arguments for the MultiVectorRetriever class.
 */
export interface MultiVectorRetrieverInput extends BaseRetrieverInput {
  vectorstore: VectorStoreInterface;
  /** @deprecated Prefer `baseStore`. */
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

  /**
   * Add documents to the byte store.
   *
   * @param {Array<DocumentInterface>} docs The docs to add to the byte store
   * @param {{ ids: Array<string> | undefined } | undefined} config Optional config object for passing doc IDs through.
   */
  async addDocuments(
    docs: DocumentInterface[],
    config?: {
      ids?: string[];
    }
  ): Promise<void> {
    let ids: string[] = [];
    if (!config?.ids) {
      ids.concat(docs.map((_) => uuidv4()));
    } else {
      ids = config.ids;
    }
    const keyValuePairs = docs.map(
      (doc, i) => [ids[i], doc] as [string, DocumentInterface]
    );
    await this.docstore.mset(keyValuePairs);
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
