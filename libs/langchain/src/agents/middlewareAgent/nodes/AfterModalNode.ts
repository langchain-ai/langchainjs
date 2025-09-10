/* eslint-disable @typescript-eslint/no-explicit-any */
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { MiddlewareNode } from "./middleware.js";
import type {
  Controls,
  AgentMiddleware,
  MiddlewareResult,
  Runtime,
} from "../types.js";

/**
 * Node for executing a single middleware's afterModel hook.
 */
export class AfterModelNode<
  TStateSchema extends Record<string, any> = Record<string, any>,
  TContextSchema extends Record<string, any> = Record<string, any>
> extends MiddlewareNode<TStateSchema, TContextSchema> {
  lc_namespace = ["langchain", "agents", "afterModalNodes"];

  name: string;

  constructor(public middleware: AgentMiddleware<any, any, any>) {
    super({
      name: `AfterModelNode_${middleware.name}`,
      func: async (state: TStateSchema, config?: LangGraphRunnableConfig) =>
        this.invokeMiddleware(state, config),
    });
    this.name = `AfterModelNode_${middleware.name}`;
  }

  runHook(
    state: TStateSchema,
    runtime: Runtime<TContextSchema>,
    controls: Controls<TStateSchema>
  ) {
    return this.middleware.afterModel!(state, runtime, controls) as Promise<
      MiddlewareResult<TStateSchema>
    >;
  }
}
