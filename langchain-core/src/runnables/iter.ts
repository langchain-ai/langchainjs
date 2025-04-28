import type { RunnableConfig } from "../runnables/types.js";
import { AsyncLocalStorageProviderSingleton } from "../singletons/index.js";
import { pickRunnableConfigKeys } from "./config.js";

export function isIterableIterator(
  thing: unknown
): thing is IterableIterator<unknown> {
  return (
    typeof thing === "object" &&
    thing !== null &&
    typeof (thing as Generator)[Symbol.iterator] === "function" &&
    // avoid detecting array/set as iterator
    typeof (thing as Generator).next === "function"
  );
}

export const isIterator = (x: unknown): x is Iterator<unknown> =>
  x != null &&
  typeof x === "object" &&
  "next" in x &&
  typeof x.next === "function";

export function isAsyncIterable(
  thing: unknown
): thing is AsyncIterable<unknown> {
  return (
    typeof thing === "object" &&
    thing !== null &&
    typeof (thing as AsyncIterable<unknown>)[Symbol.asyncIterator] ===
      "function"
  );
}

export function* consumeIteratorInContext<T>(
  context: Partial<RunnableConfig> | undefined,
  iter: IterableIterator<T>
): IterableIterator<T> {
  while (true) {
    const { value, done } = AsyncLocalStorageProviderSingleton.runWithConfig(
      pickRunnableConfigKeys(context),
      iter.next.bind(iter),
      true
    );
    if (done) {
      break;
    } else {
      yield value;
    }
  }
}

export async function* consumeAsyncIterableInContext<T>(
  context: Partial<RunnableConfig> | undefined,
  iter: AsyncIterable<T>
): AsyncIterableIterator<T> {
  const iterator = iter[Symbol.asyncIterator]();
  while (true) {
    const { value, done } =
      await AsyncLocalStorageProviderSingleton.runWithConfig(
        pickRunnableConfigKeys(context),
        iterator.next.bind(iter),
        true
      );
    if (done) {
      break;
    } else {
      yield value;
    }
  }
}
