import { getEnvironmentVariable } from "./env.js";

export const isTracingEnabled = (tracingEnabled?: boolean): boolean => {
  if (tracingEnabled !== undefined) {
    return tracingEnabled;
  }
  const envVars = [
    "LANGSMITH_TRACING_V2",
    "LANGCHAIN_TRACING_V2",
    "LANGSMITH_TRACING",
    "LANGCHAIN_TRACING",
  ];
  return !!envVars.find((envVar) => getEnvironmentVariable(envVar) === "true");
};
