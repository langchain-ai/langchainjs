import { describe, test, expect } from "vitest";
import { _HashedDocument, index } from "../base.js";
import type {
  ListKeyOptions,
  RecordManagerInterface,
} from "../record_manager.js";
import { Document, type DocumentInterface } from "../../documents/document.js";
import type { VectorStore } from "../../vectorstores.js";

class InMemoryRecordManager implements RecordManagerInterface {
  records = new Map<string, { updatedAt: number; groupId: string | null }>();

  private time = 0;

  async createSchema(): Promise<void> {}

  async getTime(): Promise<number> {
    this.time += 1;
    return this.time;
  }

  async update(
    keys: string[],
    options: { groupIds?: (string | null)[]; timeAtLeast?: number } = {}
  ): Promise<void> {
    const updatedAt = await this.getTime();
    keys.forEach((key, i) => {
      this.records.set(key, {
        updatedAt,
        groupId: options.groupIds?.[i] ?? null,
      });
    });
  }

  async exists(keys: string[]): Promise<boolean[]> {
    return keys.map((key) => this.records.has(key));
  }

  async listKeys(options: ListKeyOptions = {}): Promise<string[]> {
    const keys = [...this.records.entries()]
      .filter(([, record]) => {
        if (options.before !== undefined && record.updatedAt >= options.before)
          return false;
        if (
          options.groupIds !== undefined &&
          !options.groupIds.includes(record.groupId)
        )
          return false;
        return true;
      })
      .map(([key]) => key);
    return options.limit !== undefined ? keys.slice(0, options.limit) : keys;
  }

  async deleteKeys(keys: string[]): Promise<void> {
    keys.forEach((key) => this.records.delete(key));
  }
}

class InMemoryDocStore {
  docs = new Map<string, DocumentInterface>();

  async addDocuments(
    documents: DocumentInterface[],
    options: { ids: string[] }
  ): Promise<void> {
    documents.forEach((doc, i) => this.docs.set(options.ids[i], doc));
  }

  async delete({ ids }: { ids: string[] }): Promise<void> {
    ids.forEach((id) => this.docs.delete(id));
  }
}

describe("_HashedDocument", () => {
  test("hashes nested metadata, not just its top-level keys", () => {
    const first = _HashedDocument.fromDocument(
      new Document({
        pageContent: "same text",
        metadata: { source: "a.txt", loc: { lines: { from: 1, to: 1 } } },
      })
    );
    const second = _HashedDocument.fromDocument(
      new Document({
        pageContent: "same text",
        metadata: { source: "a.txt", loc: { lines: { from: 9, to: 9 } } },
      })
    );
    expect(first.metadataHash).not.toBe(second.metadataHash);
    expect(first.uid).not.toBe(second.uid);
  });

  test("hashes objects inside arrays", () => {
    const first = _HashedDocument.fromDocument(
      new Document({ pageContent: "x", metadata: { authors: [{ name: "a" }] } })
    );
    const second = _HashedDocument.fromDocument(
      new Document({ pageContent: "x", metadata: { authors: [{ name: "b" }] } })
    );
    expect(first.uid).not.toBe(second.uid);
  });

  test("nested key order does not change the hash", () => {
    const first = _HashedDocument.fromDocument(
      new Document({
        pageContent: "x",
        metadata: { b: 1, a: { y: 2, x: [{ q: 1, p: 2 }] } },
      })
    );
    const second = _HashedDocument.fromDocument(
      new Document({
        pageContent: "x",
        metadata: { a: { x: [{ p: 2, q: 1 }], y: 2 }, b: 1 },
      })
    );
    expect(first.uid).toBe(second.uid);
  });

  test("hash of flat metadata is unchanged", () => {
    const doc = _HashedDocument.fromDocument(
      new Document({
        pageContent: "hello",
        metadata: { source: "a.txt", page: 2, tags: ["x", "y"] },
      })
    );
    // Pinned so existing record manager entries keep matching.
    expect(doc.metadataHash).toBe("e51d762d-bc39-50a9-afef-295dd72df994");
    expect(doc.uid).toBe("7fda8b96-3ca7-5c15-82ae-6322a2314328");
  });
});

describe("index", () => {
  test("re-indexes a document whose nested metadata changed", async () => {
    const recordManager = new InMemoryRecordManager();
    const store = new InMemoryDocStore();
    const vectorStore = store as unknown as VectorStore;

    await index({
      docsSource: [
        new Document({
          pageContent: "chunk",
          metadata: { source: "a.txt", info: { author: "old" } },
        }),
      ],
      recordManager,
      vectorStore,
      options: { cleanup: "incremental", sourceIdKey: "source" },
    });

    const result = await index({
      docsSource: [
        new Document({
          pageContent: "chunk",
          metadata: { source: "a.txt", info: { author: "new" } },
        }),
      ],
      recordManager,
      vectorStore,
      options: { cleanup: "incremental", sourceIdKey: "source" },
    });

    expect(result).toEqual({
      numAdded: 1,
      numDeleted: 1,
      numUpdated: 0,
      numSkipped: 0,
    });
    const stored = [...store.docs.values()];
    expect(stored).toHaveLength(1);
    expect(stored[0].metadata.info).toEqual({ author: "new" });
  });
});
