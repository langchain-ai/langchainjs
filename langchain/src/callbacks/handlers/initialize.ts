import { LangChainTracer } from "./tracers.js";

export async function getTracingCallbackHandler(
  session?: string
): Promise<LangChainTracer> {
  const tracer = new LangChainTracer();
  if (session) {
    await tracer.loadSession(session);
  } else {
    await tracer.loadDefaultSession();
  }
  return tracer;
}
