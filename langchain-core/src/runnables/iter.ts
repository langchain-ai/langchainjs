import { AsyncLocalStorageProviderSingleton } from "../singletons/index.js";
import { RunnableConfig } from "./config.js";

export function isIterator(thing: unknown): thing is Generator {
  return (
    typeof thing === "object" &&
    thing !== null &&
    typeof (thing as Generator)[Symbol.iterator] === "function" &&
    typeof (thing as Generator).next === "function"
  );
}

export function isAsyncIterator(thing: unknown): thing is AsyncGenerator {
  return (
    typeof thing === "object" &&
    thing !== null &&
    typeof (thing as AsyncGenerator)[Symbol.asyncIterator] === "function" &&
    typeof (thing as AsyncGenerator).next === "function"
  );
}

export function* consumeIteratorInContext<T>(
  context: Partial<RunnableConfig> | undefined,
  iter: Generator<T>
): Generator<T> {
  const storage = AsyncLocalStorageProviderSingleton.getInstance();
  while (true) {
    const { value, done } = storage.run(context, iter.next.bind(iter));
    if (done) {
      break;
    } else {
      yield value;
    }
  }
}

export async function* consumeAsyncIteratorInContext<T>(
  context: Partial<RunnableConfig> | undefined,
  iter: AsyncGenerator<T>
): AsyncGenerator<T> {
  const storage = AsyncLocalStorageProviderSingleton.getInstance();
  while (true) {
    const { value, done } = await storage.run(context, iter.next.bind(iter));
    if (done) {
      break;
    } else {
      yield value;
    }
  }
}
