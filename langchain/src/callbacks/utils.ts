import { LangChainTracer } from "./tracers.js";
import { CallbackManager } from "./base.js";

export async function getTracingCallbackManager(
  session?: string
): Promise<CallbackManager> {
  const manager = new CallbackManager();
  const tracer = new LangChainTracer();
  if (session) {
    await tracer.loadSession(session);
  } else {
    await tracer.loadDefaultSession();
  }
  manager.addHandler(tracer);
  return manager;
}
