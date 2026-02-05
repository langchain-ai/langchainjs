import debug from "debug";

const packageName = "@langchain/mcp-adapters";

const debugLog: Record<string, debug.Debugger> = {};
export function getDebugLog(instanceName: string = "client") {
  const key = `${packageName}:${instanceName}`;
  if (!debugLog[key]) {
    debugLog[key] = debug(key);
  }
  return debugLog[key];
}
