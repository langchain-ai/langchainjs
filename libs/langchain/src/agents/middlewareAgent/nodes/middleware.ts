/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-instanceof/no-instanceof */
import { z } from "zod/v3";
import { LangGraphRunnableConfig, Command } from "@langchain/langgraph";

import { RunnableCallable } from "../../RunnableCallable.js";
import type {
  Runtime,
  ControlAction,
  AgentMiddleware,
  MiddlewareResult,
} from "../types.js";
import {
  derivePrivateState,
  parseToolCalls,
  parseToolResults,
} from "./utils.js";

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
    config?: Runtime<TStateSchema, TContextSchema>
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
    const runtime: Runtime<TStateSchema, TContextSchema> = {
      toolCalls: parseToolCalls(state.messages),
      toolResults: parseToolResults(state.messages),
      context: filteredContext,
      writer: config?.writer,
      interrupt: config?.interrupt,
      signal: config?.signal,
      terminate: (
        result?: Partial<TStateSchema> | Error
      ): ControlAction<TStateSchema> => {
        if (result instanceof Error) {
          throw result;
        }
        return { type: "terminate", result };
      },
    };

    const result = await this.runHook(state, runtime);

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
      if (result.type === "terminate") {
        if (result.error) {
          throw result.error;
        }
        return { ...state, ...(result.result || {}) };
      }

      throw new Error(`Invalid control action: ${JSON.stringify(result)}`);
    }

    /**
     * If result is a state update, merge it with current state
     */
    return { ...state, ...result };
  }

  get nodeOptions(): {
    input: z.ZodObject<TStateSchema>;
  } {
    return {
      input: derivePrivateState(
        this.middleware.stateSchema
      ) as z.ZodObject<TStateSchema>,
    };
  }
}
