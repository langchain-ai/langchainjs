import { LangChainTracer, LangChainTracerV2 } from "./tracers.js";

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

export async function getTracingV2CallbackHandler(
  session?: string
): Promise<LangChainTracerV2> {
  const tracer = new LangChainTracerV2();
  if (session) {
    await tracer.loadSession(session);
  } else {
    await tracer.loadDefaultSession();
  }
  return tracer;
}
