import { RunnableConfig } from "@langchain/core/runnables";
import { MiddlewareNode } from "./middleware.js";
import type {
  Controls,
  AgentMiddleware,
  MiddlewareResult,
  Runtime,
} from "../types.js";

/**
 * Node for executing a single middleware's beforeModel hook.
 */
export class BeforeModelNode<
  TStateSchema extends Record<string, any> = Record<string, any>,
  TContextSchema extends Record<string, any> = Record<string, any>
> extends MiddlewareNode<TStateSchema, TContextSchema> {
  lc_namespace = ["langchain", "agents", "beforeModalNodes"];

  constructor(public middleware: AgentMiddleware<any, any, any>) {
    super({
      name: `BeforeModelNode_${middleware.name}`,
      func: async (
        state: TStateSchema,
        config?: RunnableConfig<TContextSchema>
      ) => this.invokeMiddleware(state, config),
    });
  }

  runHook(
    state: TStateSchema,
    runtime: Runtime<TContextSchema>,
    controls: Controls<TStateSchema>
  ) {
    return this.middleware.beforeModel!(state, runtime, controls) as Promise<
      MiddlewareResult<TStateSchema>
    >;
  }
}
