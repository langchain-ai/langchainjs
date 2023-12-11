import { BaseStoreInterface } from "../schema/storage.js";
import { Document } from "../document.js";
import { BaseRetriever, BaseRetrieverInput } from "../schema/retriever.js";
import { VectorStore } from "../vectorstores/base.js";

/**
 * Arguments for the MultiVectorRetriever class.
 */
export interface MultiVectorRetrieverInput extends BaseRetrieverInput {
  vectorstore: VectorStore;
  docstore: BaseStoreInterface<string, Document>;
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
 *   docstore: new InMemoryStore(),
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

  public vectorstore: VectorStore;

  public docstore: BaseStoreInterface<string, Document>;

  protected idKey: string;

  protected childK?: number;

  protected parentK?: number;

  constructor(args: MultiVectorRetrieverInput) {
    super(args);
    this.vectorstore = args.vectorstore;
    this.docstore = args.docstore;
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
