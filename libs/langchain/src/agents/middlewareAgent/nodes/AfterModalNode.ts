/* eslint-disable @typescript-eslint/no-explicit-any */
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { MiddlewareNode, MiddlewareNodeOptions } from "./middleware.js";
import type { AgentMiddleware, MiddlewareResult, Runtime } from "../types.js";

/**
 * Node for executing a single middleware's afterModel hook.
 */
export class AfterModelNode<
  TStateSchema extends Record<string, any> = Record<string, any>,
  TContextSchema extends Record<string, any> = Record<string, any>
> extends MiddlewareNode<TStateSchema, TContextSchema> {
  lc_namespace = ["langchain", "agents", "afterModalNodes"];

  name: string;

  constructor(
    public middleware: AgentMiddleware<any, any, any>,
    options: MiddlewareNodeOptions
  ) {
    super(
      {
        name: `AfterModelNode_${middleware.name}`,
        func: async (state: TStateSchema, config?: LangGraphRunnableConfig) =>
          this.invokeMiddleware(state, config),
      },
      options
    );
    this.name = `AfterModelNode_${middleware.name}`;
  }

  runHook(state: TStateSchema, runtime: Runtime<TStateSchema, TContextSchema>) {
    return this.middleware.afterModel!(
      state,
      runtime as Runtime<TStateSchema, unknown>
    ) as Promise<MiddlewareResult<TStateSchema>>;
  }
}
