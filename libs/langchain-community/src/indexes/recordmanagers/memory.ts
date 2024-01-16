import {
  ListKeyOptions,
  RecordManager,
  UpdateOptions,
} from "../recordmanagers.js";

interface MemoryRecord {
  updatedAt: number;
  groupId: string | null;
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
    // compatibility with other record managers
    return Promise.resolve();
  }

  async getTime(): Promise<number> {
    return Promise.resolve(Date.now());
  }

  async update(keys: string[], updateOptions?: UpdateOptions): Promise<void> {
    const updatedAt = await this.getTime();
    const { timeAtLeast } = updateOptions ?? {};
    let { groupIds } = updateOptions ?? {};

    if (timeAtLeast && updatedAt < timeAtLeast) {
      throw new Error(
        `Time sync issue with database ${updatedAt} < ${timeAtLeast}`
      );
    }

    groupIds = groupIds ?? keys.map(() => null);

    if (groupIds.length !== keys.length) {
      throw new Error(
        `Number of keys (${keys.length}) does not match number of group_ids ${groupIds.length})`
      );
    }

    keys.forEach((key, i) => {
      const old = this.records.get(key);
      if (old) {
        old.updatedAt = updatedAt;
      } else {
        this.records.set(key, { updatedAt, groupId: groupIds[i] });
      }
    });
  }

  async exists(keys: string[]): Promise<boolean[]> {
    return Promise.resolve(keys.map((key) => this.records.has(key)));
  }

  async listKeys(options?: ListKeyOptions): Promise<string[]> {
    const { before, after, limit, groupIds } = options ?? {};

    const filteredRecords = Array.from(this.records).filter(([_key, doc]) => {
      const isBefore = !before || doc.updatedAt < before;
      const isAfter = !after || doc.updatedAt > after;
      const belongsToGroup = !groupIds || groupIds.includes(doc.groupId);
      return isBefore && isAfter && belongsToGroup;
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
    // nothing to do here
    // compatibility with other record managers
    return Promise.resolve();
  }
}
