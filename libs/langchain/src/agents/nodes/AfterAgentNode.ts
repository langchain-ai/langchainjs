import { RunnableConfig } from "@langchain/core/runnables";
import { MiddlewareNode } from "./middleware.js";
import type { AnyAgentMiddleware, MiddlewareResult } from "../middleware/types.js";
import type { AgentBuiltInState, Runtime } from "../runtime.js";
import { getHookFunction } from "../middleware/utils.js";

/**
 * Node for executing a single middleware's afterAgent hook.
 */
export class AfterAgentNode<
  TStateSchema extends Record<string, unknown> = Record<string, unknown>,
  TContextSchema extends Record<string, unknown> = Record<string, unknown>,
> extends MiddlewareNode<TStateSchema, TContextSchema> {
  lc_namespace = ["langchain", "agents", "afterAgentNodes"];

  constructor(
    public middleware: AnyAgentMiddleware
  ) {
    super({
      name: `AfterAgentNode_${middleware.name}`,
      func: async (
        state: TStateSchema,
        config?: RunnableConfig<TContextSchema>
      ) => this.invokeMiddleware(state, config),
    });
  }

  runHook(state: TStateSchema, runtime: Runtime<TContextSchema>) {
    const fn = getHookFunction(this.middleware.afterAgent!);
    return fn(
      state as Record<string, unknown> & AgentBuiltInState,
      runtime as Runtime<unknown>
    ) as Promise<MiddlewareResult<TStateSchema>>;
  }
}
