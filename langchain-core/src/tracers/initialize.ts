import { LangChainTracer } from "./tracer_langchain.js";

/**
 * Function that returns an instance of `LangChainTracer`. It does not
 * load any session data.
 * @returns An instance of `LangChainTracer`.
 */
export async function getTracingV2CallbackHandler(): Promise<LangChainTracer> {
  return new LangChainTracer();
}
