import { RunnableConfig } from "@langchain/core/runnables";
import { RunnableCallable } from "../RunnableCallable.js";
import type {
  IMiddleware,
  Runtime,
  Controls,
  ControlAction,
} from "../types.js";

/**
 * Node for executing a single middleware's beforeModel hook.
 */
export class BeforeModelNode<
  TStateSchema extends Record<string, any> = Record<string, any>,
  TContextSchema extends Record<string, any> = Record<string, any>
> extends RunnableCallable<any, any> {
  lc_namespace = ["langchain", "agents", "nodes"];

  constructor(private middleware: IMiddleware<any, any, any>) {
    super({
      name: `BeforeModelNode_${middleware.name}`,
      func: async (
        state: TStateSchema,
        config?: RunnableConfig<TContextSchema>
      ) => this._invoke(state, config),
    });
  }

  async _invoke(state: any, config?: RunnableConfig): Promise<any> {
    let currentState = { ...state };

    /**
     * ToDo: implement later
     */
    const runtime: Runtime<any> = {
      toolCalls: [],
      toolResults: [],
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      context: config?.configurable?.context || {},
      currentIteration: 0,
    };

    const controls: Controls<any> = {
      jumpTo: (
        target: "model" | "tools",
        stateUpdate?: any
      ): ControlAction => ({
        type: "jump",
        target,
        stateUpdate,
      }),
      terminate: (result?: any | Error): ControlAction => {
        if (result instanceof Error) {
          return { type: "terminate", error: result };
        }
        return { type: "terminate", result };
      },
    };

    const result = await this.middleware.beforeModel?.(
      currentState,
      runtime,
      controls
    );

    if (result) {
      if (typeof result === "object" && "type" in result) {
        // Handle control actions
        const action = result as ControlAction;
        if (action.type === "terminate") {
          if (action.error) {
            throw action.error;
          }
          return { ...currentState, ...(action.result || {}) };
        }
        // TODO: Handle jump actions
      } else {
        // Merge state updates
        currentState = { ...currentState, ...result };
      }
    }

    return currentState;
  }
}
