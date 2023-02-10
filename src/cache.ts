import { Generation } from "./llms";

const getKey = (prompt: string, llmKey: string): string =>
  `${prompt}_${llmKey}`;

export abstract class BaseCache<T = Generation[]> {
  abstract lookup(prompt: string, llmKey: string): T | undefined;

  abstract update(prompt: string, llmKey: string, value: T): void;
}

export class InMemoryCache<T = Generation[]> extends BaseCache<T> {
  private cache: Record<string, T>;

  constructor() {
    super();
    this.cache = {};
  }

  lookup(prompt: string, llmKey: string) {
    return this.cache[getKey(prompt, llmKey)];
  }

  update(prompt: string, llmKey: string, value: T) {
    this.cache[getKey(prompt, llmKey)] = value;
  }
}
