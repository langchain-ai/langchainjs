import { createAgent as createAgentImpl } from "./createAgent.js";
import { createAgent as createMiddlewareAgent } from "./middlewareAgent/index.js";

export function createAgent(params: unknown) {
  if (typeof params === "object" && params && "middlewares" in params) {
    return createMiddlewareAgent(params as any);
  }
  return createAgentImpl(params as any);
}

export * from "./types.js";
export * from "./errors.js";
export * from "./interrupt.js";
export { ToolNode } from "./nodes/ToolNode.js";
export {
  toolStrategy,
  providerStrategy,
  ToolStrategy,
  ProviderStrategy,
  type ResponseFormat,
} from "./responses.js";
