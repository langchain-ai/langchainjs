import {
  ListKeyOptions,
  RecordManager,
  UpdateOptions,
} from "@langchain/core/recordmanagers";

interface MemoryRecord {
  updatedAt: number;
}

export class InMemoryRecordManger extends RecordManager {
  records: Map<string, MemoryRecord>;


  constructor() {
    super();
    this.records = new Map();
  }

  _recordManagerType(): string {
    return "Memory";
  }

  async createSchema(): Promise<void> {
    // nothing to do here
    return Promise.resolve();
  }

  async getTime(): Promise<number> {
    return Promise.resolve(Date.now());
  }

  async update(keys: string[], updateOptions?: UpdateOptions): Promise<void> {
    const updatedAt = await this.getTime();
    const { timeAtLeast } = updateOptions ?? {};

    if (timeAtLeast && updatedAt < timeAtLeast) {
      throw new Error(
        `Time sync issue with database ${updatedAt} < ${timeAtLeast}`
      );
    }

    keys.forEach((key) => {
      const old = this.records.get(key);
      if (old) {
        old.updatedAt = updatedAt;
      } else {
        this.records.set(key, { updatedAt });
      }
    });
  }

  async exists(keys: string[]): Promise<boolean[]> {
    return Promise.resolve(keys.map((key) => this.records.has(key)));
  }

  async listKeys(options?: ListKeyOptions): Promise<string[]> {
    const { before, after, limit } = options ?? {};

    const filteredRecords = Array.from(this.records).filter(([key, doc]) => {
      const isBefore = !before || doc.updatedAt < before;
      const isAfter = !after || doc.updatedAt > after;
      return isBefore && isAfter;
    });

    return Promise.resolve(
      filteredRecords
        .map(([key]) => key)
        .slice(0, limit ?? filteredRecords.length)
    );
  }

  async deleteKeys(keys: string[]): Promise<void> {
    keys.forEach((key) => this.records.delete(key));
    return Promise.resolve();
  }

  async end(): Promise<void> {
    return Promise.resolve();
  }
}
