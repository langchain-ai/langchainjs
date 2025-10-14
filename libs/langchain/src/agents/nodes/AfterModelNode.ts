import { RunnableConfig } from "@langchain/core/runnables";
import { MiddlewareNode, MiddlewareNodeOptions } from "./middleware.js";
import type {
  AgentMiddleware,
  MiddlewareResult,
  AgentBuiltInState,
} from "@langchain/core/middleware";
import type { Runtime } from "../types.js";

/**
 * Node for executing a single middleware's afterModel hook.
 */
export class AfterModelNode<
  TStateSchema extends Record<string, unknown> = Record<string, unknown>,
  TContextSchema extends Record<string, unknown> = Record<string, unknown>
> extends MiddlewareNode<TStateSchema, TContextSchema> {
  lc_namespace = ["langchain", "agents", "afterModelNodes"];

  constructor(
    public middleware: AgentMiddleware,
    options: MiddlewareNodeOptions
  ) {
    super(
      {
        name: `AfterModelNode_${middleware.name}`,
        func: async (
          state: TStateSchema,
          config?: RunnableConfig<TContextSchema>
        ) => this.invokeMiddleware(state, config),
      },
      options
    );
  }

  runHook(state: TStateSchema, runtime: Runtime<TContextSchema>) {
    return this.middleware.afterModel!(
      state as Record<string, unknown> & AgentBuiltInState,
      runtime
    ) as Promise<MiddlewareResult<TStateSchema>>;
  }
}
