import type { LangChainMatchers } from "../../libs/langchain-core/src/testing/matchers.js";

type LangChainMatcherResult = void | Promise<void>;

declare module "@vitest/expect" {
  interface Matchers<
    T = unknown,
  > extends LangChainMatchers<LangChainMatcherResult> {}
  interface Assertion<
    T = unknown,
  > extends LangChainMatchers<LangChainMatcherResult> {}
  interface PromisifyAssertion<T = unknown> extends LangChainMatchers<
    Promise<void>
  > {}
}

declare module "vitest" {
  interface Assertion<
    T = unknown,
  > extends LangChainMatchers<LangChainMatcherResult> {}
  interface PromisifyAssertion<T = unknown> extends LangChainMatchers<
    Promise<void>
  > {}
}

declare global {
  namespace jest {
    interface Matchers<R, T = unknown> extends LangChainMatchers<R> {}
  }
}

export {};
