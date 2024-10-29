import { LangChainTracer } from "../tracers/tracer_langchain.js";

let tracerInstance: LangChainTracer;

export const getDefaultLangChainTracerSingleton = () => {
  if (tracerInstance === undefined) {
    tracerInstance = new LangChainTracer();
  }
  return tracerInstance;
};
