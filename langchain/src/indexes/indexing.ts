import crypto from "crypto";
import { VectorStore } from "@langchain/core/vectorstores";
import { v5 as uuidv5 } from "uuid";
import { BaseDocumentLoader } from "../document_loaders/base.js";
import { RecordManagerInterface, UUID_NAMESPACE } from "./recordmanager.js";
import { Document } from "../document.js";

class HashedDocument extends Document {
  uid: string;

  hash_?: string;

  contentHash?: string;

  metadataHash?: string;

  pageContent: string;

  metadata: Record<string, any>;

  constructor(
    page_content: string,
    metadata: Record<string, any>,
    uid: string
  ) {
    super({ pageContent: page_content, metadata });
    this.uid = uid;
    this.pageContent = page_content;
    this.metadata = metadata;
  }

  calculateHashes(): void {
    const content = this.pageContent;
    const { metadata } = this;

    const forbiddenKeys = ["hash_", "content_hash", "metadata_hash"];

    for (const key of forbiddenKeys) {
      if (key in metadata) {
        throw new Error(
          `Metadata cannot contain key ${key} as it is reserved for internal use.`
        );
      }
    }

    const contentHash = this.hashStringToUUID(content);

    try {
      const metadataHash = this.hashNestedDictToUUID(metadata);
      this.contentHash = contentHash;
      this.metadataHash = metadataHash;
      this.hash_ = this.hashStringToUUID(contentHash + metadataHash);
    } catch (e) {
      throw new Error(
        `Failed to hash metadata: ${e}. Please use a dict that can be serialized using json.`
      );
    }

    if (!this.uid) {
      this.uid = this.hash_;
    }
  }

  toDocument(): Document {
    return new Document({
      pageContent: this.pageContent,
      metadata: this.metadata,
    });
  }

  static fromDocument(document: Document, uid?: string): HashedDocument {
    const doc = new HashedDocument(
      document.pageContent,
      document.metadata,
      uid || (document as Document & { uid: string }).uid
    );
    doc.calculateHashes();
    return doc;
  }

  private hashStringToUUID(inputString: string): string {
    const hash_value = crypto
      .createHash("sha1")
      .update(inputString, "utf-8")
      .digest("hex");
    return uuidv5(hash_value, UUID_NAMESPACE as string);
  }

  private hashNestedDictToUUID(data: Record<string, unknown>): string {
    const serialized_data = JSON.stringify(data, Object.keys(data).sort());
    const hash_value = crypto
      .createHash("sha1")
      .update(serialized_data, "utf-8")
      .digest("hex");
    return uuidv5(hash_value, UUID_NAMESPACE as string);
  }
}

export type CleanupMode = "full" | "incremental";

export type IndexOptions = {
  batchSize?: number;
  cleanup?: CleanupMode;
  sourceIdKey?: string | ((doc: Document) => string);
  cleanupBatchSize?: number;
  forceUpdate?: boolean;
};

function batch<T>(size: number, iterable: T[]): T[][] {
  const batches: T[][] = [];
  let currentBatch: T[] = [];

  iterable.forEach((item) => {
    currentBatch.push(item);

    if (currentBatch.length >= size) {
      batches.push(currentBatch);
      currentBatch = [];
    }
  });

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function deduplicateInOrder(
  hashedDocuments: HashedDocument[]
): HashedDocument[] {
  const seen = new Set<string>();
  const deduplicated: HashedDocument[] = [];

  for (const hashedDoc of hashedDocuments) {
    if (!hashedDoc.hash_) {
      throw new Error("Hashed document does not have a hash");
    }

    if (!seen.has(hashedDoc.hash_)) {
      seen.add(hashedDoc.hash_);
      deduplicated.push(hashedDoc);
    }
  }
  return deduplicated;
}

function get_source_id_assigner(
  sourceIdKey: string | ((doc: Document) => string) | null
): (doc: Document) => string | null {
  if (sourceIdKey === null) {
    return (_doc: Document) => null;
  } else if (typeof sourceIdKey === "string") {
    return (doc: Document) => doc.metadata[sourceIdKey];
  } else if (typeof sourceIdKey === "function") {
    return sourceIdKey;
  } else {
    throw new Error(
      `sourceIdKey should be null, a string or a function, got ${typeof sourceIdKey}`
    );
  }
}

export async function index(
  docsSource: BaseDocumentLoader | Document[],
  recordManager: RecordManagerInterface,
  vectorStore: VectorStore,
  {
    batchSize = 100,
    cleanup = undefined,
    sourceIdKey = undefined,
    cleanupBatchSize = 1000,
    forceUpdate = false,
  }: IndexOptions
) {
  if (cleanup === "incremental" && !sourceIdKey) {
    throw new Error(
      "Source id key s required when cleanup mode is incremental"
    );
  }

  const docs =
    docsSource instanceof BaseDocumentLoader // eslint-disable-line no-instanceof/no-instanceof
      ? await docsSource.load()
      : docsSource;

  const sourceIdAssigner = get_source_id_assigner(sourceIdKey ?? null);

  const indexStartDt = await recordManager.getTime();
  let numAdded = 0;
  let numDeleted = 0;
  let numUpdated = 0;
  let numSkipped = 0;

  const batches = batch(batchSize, docs);

  for (const batch of batches) {
    const hashedDocs = deduplicateInOrder(
      batch.map((doc) => HashedDocument.fromDocument(doc))
    );

    const sourceIds = hashedDocs.map((doc) => sourceIdAssigner(doc));

    if (cleanup === "incremental") {
      hashedDocs.forEach((_hashedDoc, index) => {
        const source = sourceIds[index];
        if (source === null) {
          throw new Error(
            "sourceIdKey must be provided when cleanup is incremental"
          );
        }
      });

      const batchExists = await recordManager.exists(
        hashedDocs.map((doc) => doc.uid)
      );

      const uids: string[] = [];
      const docsToIndex: Document[] = [];
      const docsToUpdate: string[] = [];
      const seenDocs = new Set<string>();
      hashedDocs.forEach((hashedDoc, i) => {
        const docExists = batchExists[i];
        if (docExists) {
          if (forceUpdate) {
            seenDocs.add(hashedDoc.uid);
          } else {
            docsToUpdate.push(hashedDoc.uid);
          }
          return;
        }
        uids.push(hashedDoc.uid);
        docsToIndex.push(hashedDoc.toDocument());
      });

      if (docsToUpdate.length > 0) {
        await recordManager.update(docsToUpdate, { timeAtLeast: indexStartDt });
        numSkipped += docsToUpdate.length;
      }

      if (docsToIndex.length > 0) {
        await vectorStore.addDocuments(docsToIndex, { ids: uids });
        numAdded += docsToIndex.length - seenDocs.size;
        numUpdated += seenDocs.size;
      }

      await recordManager.update(
        hashedDocs.map((doc) => doc.uid),
        { timeAtLeast: indexStartDt, groupIds: sourceIds }
      );

      if (cleanup === "incremental") {
        const uidsToDelete = await recordManager.listKeys({
          before: indexStartDt,
          limit: cleanupBatchSize,
          groupIds: sourceIds,
        });
        await vectorStore.delete({ ids: uidsToDelete });
        await recordManager.deleteKeys(uidsToDelete);
        numDeleted += uidsToDelete.length;
      }
    }
  }

  if (cleanup === "full") {
    let uidsToDelete = await recordManager.listKeys({
      before: indexStartDt,
      limit: cleanupBatchSize,
    });
    while (uidsToDelete.length > 0) {
      await vectorStore.delete(uidsToDelete);
      await recordManager.deleteKeys(uidsToDelete);
      numDeleted += uidsToDelete.length;
      uidsToDelete = await recordManager.listKeys({
        before: indexStartDt,
        limit: cleanupBatchSize,
      });
    }
  }

  return {
    numAdded,
    numDeleted,
    numUpdated,
    numSkipped,
  };
}
