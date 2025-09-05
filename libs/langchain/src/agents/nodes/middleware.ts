import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { RunnableCallable } from "../RunnableCallable.js";
import type {
  Runtime,
  Controls,
  ControlAction,
  IMiddleware,
  MiddlewareResult,
} from "../types.js";

export abstract class MiddlewareNode<
  TStateSchema,
  TContextSchema extends Record<string, any>
> extends RunnableCallable<TStateSchema, MiddlewareResult<TStateSchema>> {
  abstract middleware: IMiddleware<any, any, any>;

  abstract runHook(
    state: TStateSchema,
    config?: Runtime<TContextSchema>,
    controls?: Controls<TStateSchema>
  ): Promise<MiddlewareResult<TStateSchema>>;

  async invokeMiddleware(
    state: TStateSchema,
    config?: LangGraphRunnableConfig
  ): Promise<TStateSchema> {
    let currentState = { ...state };

    // Filter context based on middleware's contextSchema
    let filteredContext: Record<string, any> = {};
    const configWithContext = config as any;
    // Check both config.context and config.configurable.context
    const contextSource =
      configWithContext?.context || configWithContext?.configurable?.context;
    if (this.middleware.contextSchema && contextSource) {
      // Extract only the fields relevant to this middleware's schema
      const schemaShape = (this.middleware.contextSchema as any)?.shape;
      if (schemaShape) {
        const relevantContext: Record<string, any> = {};
        for (const key of Object.keys(schemaShape)) {
          if (key in contextSource) {
            relevantContext[key] = contextSource[key];
          }
        }
        // Parse to apply defaults and validation
        try {
          filteredContext =
            this.middleware.contextSchema.parse(relevantContext);
        } catch (error) {
          // If parsing fails, use empty context
          filteredContext = {};
        }
      }
    }

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
      context: filteredContext,
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

    const result = await this.runHook(currentState, runtime, controls);

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
