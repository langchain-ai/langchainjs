// Typecheck-only copy of vitest-matchers.d.ts. The original imports core's
// *source* by relative path, which pulls core into every package's program.
// This one imports the built `@langchain/core/testing` instead, resolved from
// each package via the `paths` entry in typecheck.json.
import type { LangChainMatchers } from "@langchain/core/testing";

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
