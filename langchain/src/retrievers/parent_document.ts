import * as uuid from "uuid";

import { Document } from "../document.js";
import { VectorStore, VectorStoreRetriever } from "../vectorstores/base.js";
import { TextSplitter } from "../text_splitter.js";
import {
  MultiVectorRetriever,
  type MultiVectorRetrieverInput,
} from "./multi_vector.js";

/**
 * Interface for the fields required to initialize a
 * ParentDocumentRetriever instance.
 */
export type ParentDocumentRetrieverFields = MultiVectorRetrieverInput & {
  childSplitter: TextSplitter;
  parentSplitter?: TextSplitter;
  /**
   * A custom retriever to use when retrieving instead of
   * the `.similaritySearch` method of the vectorstore.
   */
  childDocumentRetriever?: VectorStoreRetriever<VectorStore>;
};

/**
 * A type of document retriever that splits input documents into smaller chunks
 * while separately storing and preserving the original documents.
 * The small chunks are embedded, then on retrieval, the original
 * "parent" documents are retrieved.
 *
 * This strikes a balance between better targeted retrieval with small documents
 * and the more context-rich larger documents.
 * @example
 * ```typescript
 * const retriever = new ParentDocumentRetriever({
 *   vectorstore: new MemoryVectorStore(new OpenAIEmbeddings()),
 *   docstore: new InMemoryStore(),
 *   parentSplitter: new RecursiveCharacterTextSplitter({
 *     chunkOverlap: 0,
 *     chunkSize: 500,
 *   }),
 *   childSplitter: new RecursiveCharacterTextSplitter({
 *     chunkOverlap: 0,
 *     chunkSize: 50,
 *   }),
 *   childK: 20,
 *   parentK: 5,
 * });
 *
 * const parentDocuments = await getDocuments();
 * await retriever.addDocuments(parentDocuments);
 * const retrievedDocs = await retriever.getRelevantDocuments("justice breyer");
 * ```
 */
export class ParentDocumentRetriever extends MultiVectorRetriever {
  static lc_name() {
    return "ParentDocumentRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "parent_document"];

  vectorstore: VectorStore;

  protected childSplitter: TextSplitter;

  protected parentSplitter?: TextSplitter;

  protected idKey = "doc_id";

  protected childK?: number;

  protected parentK?: number;

  childDocumentRetriever: VectorStoreRetriever<VectorStore> | undefined;

  constructor(fields: ParentDocumentRetrieverFields) {
    super(fields);
    this.vectorstore = fields.vectorstore;
    this.docstore = fields.docstore;
    this.childSplitter = fields.childSplitter;
    this.parentSplitter = fields.parentSplitter;
    this.idKey = fields.idKey ?? this.idKey;
    this.childK = fields.childK;
    this.parentK = fields.parentK;
    this.childDocumentRetriever = fields.childDocumentRetriever;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let subDocs: Document<Record<string, any>>[] = [];
    if (this.childDocumentRetriever) {
      subDocs = await this.childDocumentRetriever.getRelevantDocuments(query);
    } else {
      subDocs = await this.vectorstore.similaritySearch(query, this.childK);
    }

    // Maintain order
    const parentDocIds: string[] = [];
    for (const doc of subDocs) {
      if (!parentDocIds.includes(doc.metadata[this.idKey])) {
        parentDocIds.push(doc.metadata[this.idKey]);
      }
    }
    const parentDocs: Document[] = [];
    const storedParentDocs = await this.docstore.mget(parentDocIds);
    const retrievedDocs: Document[] = storedParentDocs.filter(
      (doc?: Document): doc is Document => doc !== undefined
    );
    parentDocs.push(...retrievedDocs);
    return parentDocs.slice(0, this.parentK);
  }

  /**
   * Adds documents to the docstore and vectorstores.
   * If a retriever is provided, it will be used to add documents instead of the vectorstore.
   * @param docs The documents to add
   * @param config.ids Optional list of ids for documents. If provided should be the same
   *   length as the list of documents. Can provided if parent documents
   *   are already in the document store and you don't want to re-add
   *   to the docstore. If not provided, random UUIDs will be used as ids.
   * @param config.addToDocstore Boolean of whether to add documents to docstore.
   * This can be false if and only if `ids` are provided. You may want
   *   to set this to False if the documents are already in the docstore
   *   and you don't want to re-add them.
   */
  async addDocuments(
    docs: Document[],
    config?: {
      ids?: string[];
      addToDocstore?: boolean;
    }
  ): Promise<void> {
    const { ids, addToDocstore = true } = config ?? {};
    const parentDocs = this.parentSplitter
      ? await this.parentSplitter.splitDocuments(docs)
      : docs;
    let parentDocIds;
    if (ids === undefined) {
      if (!addToDocstore) {
        throw new Error(
          `If ids are not passed in, "config.addToDocstore" MUST be true`
        );
      }
      parentDocIds = parentDocs.map((_doc: Document) => uuid.v4());
    } else {
      parentDocIds = ids;
    }
    if (parentDocs.length !== parentDocIds.length) {
      throw new Error(
        `Got uneven list of documents and ids.\nIf "ids" is provided, should be same length as "documents".`
      );
    }
    const embeddedDocs: Document[] = [];
    const fullDocs: Record<string, Document> = {};
    for (let i = 0; i < parentDocs.length; i += 1) {
      const parentDoc = parentDocs[i];
      const parentDocId = parentDocIds[i];
      const subDocs = await this.childSplitter.splitDocuments([parentDoc]);
      const taggedSubDocs = subDocs.map(
        (subDoc: Document) =>
          new Document({
            pageContent: subDoc.pageContent,
            metadata: { ...subDoc.metadata, [this.idKey]: parentDocId },
          })
      );
      embeddedDocs.push(...taggedSubDocs);
      fullDocs[parentDocId] = parentDoc;
    }
    if (this.childDocumentRetriever) {
      await this.childDocumentRetriever.addDocuments(embeddedDocs);
    } else {
      await this.vectorstore.addDocuments(embeddedDocs);
    }
    if (addToDocstore) {
      await this.docstore.mset(Object.entries(fullDocs));
    }
  }
}
