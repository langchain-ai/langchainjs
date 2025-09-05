import { z } from "zod";
import { LangGraphRunnableConfig, Command } from "@langchain/langgraph";
import { RunnableCallable } from "../../RunnableCallable.js";
import type {
  Runtime,
  Controls,
  ControlAction,
  AgentMiddleware,
  MiddlewareResult,
} from "../types.js";

type NodeOutput<TStateSchema extends Record<string, any>> =
  | TStateSchema
  | Command<any, TStateSchema, string>;

export abstract class MiddlewareNode<
  TStateSchema extends Record<string, any>,
  TContextSchema extends Record<string, any>
> extends RunnableCallable<TStateSchema, NodeOutput<TStateSchema>> {
  abstract middleware: AgentMiddleware<
    z.ZodObject<z.ZodRawShape>,
    z.ZodObject<z.ZodRawShape>
  >;

  abstract runHook(
    state: TStateSchema,
    config?: Runtime<TContextSchema>,
    controls?: Controls<TStateSchema>
  ): Promise<MiddlewareResult<TStateSchema>>;

  async invokeMiddleware(
    state: TStateSchema,
    config?: LangGraphRunnableConfig
  ): Promise<NodeOutput<TStateSchema>> {
    /**
     * Filter context based on middleware's contextSchema
     */
    let filteredContext = {} as TContextSchema;
    /**
     * Check both config.context and config.configurable.context
     */
    if (this.middleware.contextSchema && config?.context) {
      /**
       * Extract only the fields relevant to this middleware's schema
       */
      const schemaShape = this.middleware.contextSchema?.shape;
      if (schemaShape) {
        const relevantContext: Record<string, unknown> = {};
        for (const key of Object.keys(schemaShape)) {
          if (key in config.context) {
            relevantContext[key] = config.context[key];
          }
        }
        /**
         * Parse to apply defaults and validation
         */
        filteredContext = this.middleware.contextSchema.parse(
          relevantContext
        ) as TContextSchema;
      }
    }

    /**
     * ToDo: implement later
     */
    const runtime: Runtime<TContextSchema> = {
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

    const controls: Controls<TStateSchema> = {
      jumpTo: (
        target: "model" | "tools",
        stateUpdate?: Partial<TStateSchema>
      ): ControlAction<TStateSchema> => ({
        type: "jump",
        target,
        stateUpdate,
      }),
      terminate: (
        result?: Partial<TStateSchema> | Error
      ): ControlAction<TStateSchema> => {
        if (result instanceof Error) {
          throw result;
        }
        return { type: "terminate", result };
      },
    };

    const result = await this.runHook(state, runtime, controls);

    /**
     * If result is undefined, return current state
     */
    if (!result) {
      return state;
    }

    /**
     * If result is a control action, handle it
     */
    if (typeof result === "object" && "type" in result) {
      // Handle control actions
      const action = result as ControlAction<TStateSchema>;
      if (action.type === "terminate") {
        if (action.error) {
          throw action.error;
        }
        return { ...state, ...(action.result || {}) };
      }

      if (action.type === "jump") {
        return new Command<any, TStateSchema, string>({
          goto: action.target,
          update: { ...state, ...(action.stateUpdate || {}) },
        });
      }

      throw new Error(`Invalid control action: ${JSON.stringify(action)}`);
    }

    /**
     * If result is a state update, merge it with current state
     */
    return { ...state, ...result };
  }
}
