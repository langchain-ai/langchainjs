import { BaseEntityStore } from "../../../schema/index.js";

export class InMemoryEntityStore extends BaseEntityStore {
  lc_namespace = ["langchain", "stores", "entity", "in_memory"];

  private store: Record<string, string | undefined>;

  constructor() {
    super();
    this.store = Object.create(null);
  }

  async get(
    key: string,
    defaultValue: string | undefined
  ): Promise<string | undefined> {
    return key in this.store ? this.store[key] : defaultValue;
  }

  async set(key: string, value: string | undefined): Promise<void> {
    this.store[key] = value;
  }

  async delete(key: string): Promise<void> {
    delete this.store[key];
  }

  async exists(key: string): Promise<boolean> {
    return key in this.store;
  }

  async clear(): Promise<void> {
    this.store = Object.create(null);
  }
}
