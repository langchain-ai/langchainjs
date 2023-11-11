import { LangChainTracer } from "./tracer_langchain.js";
import { LangChainTracerV1 } from "./tracer_langchain_v1.js";

/**
 * Function that returns an instance of `LangChainTracerV1`. If a session
 * is provided, it loads that session into the tracer; otherwise, it loads
 * a default session.
 * @param session Optional session to load into the tracer.
 * @returns An instance of `LangChainTracerV1`.
 */
export async function getTracingCallbackHandler(
  session?: string
): Promise<LangChainTracerV1> {
  const tracer = new LangChainTracerV1();
  if (session) {
    await tracer.loadSession(session);
  } else {
    await tracer.loadDefaultSession();
  }
  return tracer;
}

/**
 * Function that returns an instance of `LangChainTracer`. It does not
 * load any session data.
 * @returns An instance of `LangChainTracer`.
 */
export async function getTracingV2CallbackHandler(): Promise<LangChainTracer> {
  return new LangChainTracer();
}
