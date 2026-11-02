import type {} from "vitest";
import type { LangChainMatchers } from "./matchers.js";

declare module "vitest" {
  interface Assertion<
    R extends void | Promise<void> = void,
    T = unknown,
  > extends LangChainMatchers<R> {}
}

export type { LangChainMatchers };
