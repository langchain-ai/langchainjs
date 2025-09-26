/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-instanceof/no-instanceof */
import { z } from "zod/v3";
import { LangGraphRunnableConfig, Command } from "@langchain/langgraph";
import { interopParse } from "@langchain/core/utils/types";

import { RunnableCallable } from "../../RunnableCallable.js";
import type {
  Runtime,
  ControlAction,
  AgentMiddleware,
  MiddlewareResult,
  JumpToTarget,
} from "../types.js";
import {
  derivePrivateState,
  parseToolCalls,
  parseJumpToTarget,
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
     * Parse context using middleware's contextSchema to apply defaults and validation
     */
    if (this.middleware.contextSchema) {
      /**
       * Extract only the fields relevant to this middleware's schema
       */
      const schemaShape = this.middleware.contextSchema?.shape;
      if (schemaShape) {
        const relevantContext: Record<string, unknown> = {};
        const invokeContext = config?.context || {};
        for (const key of Object.keys(schemaShape)) {
          if (key in invokeContext) {
            relevantContext[key] = invokeContext[key];
          }
        }
        /**
         * Parse to apply defaults and validation, even if relevantContext is empty
         * This will throw if required fields are missing and no defaults exist
         */
        filteredContext = interopParse(
          this.middleware.contextSchema,
          relevantContext
        ) as TContextSchema;
      }
    }

    /**
     * ToDo: implement later
     */
    const runtime: Runtime<TStateSchema, TContextSchema> = {
      toolCalls: parseToolCalls(state.messages),
      context: filteredContext,
      writer: config?.writer,
      interrupt: config?.interrupt,
      signal: config?.signal,
      tools: this.middleware.tools ?? [],
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
      return { ...state, jumpTo: undefined };
    }

    /**
     * Verify that the jump target is allowed for the middleware
     */
    const jumpToConstraint = this.name?.startsWith("BeforeModelNode_")
      ? this.middleware.beforeModelJumpTo
      : this.middleware.afterModelJumpTo;
    if (
      typeof result.jumpTo === "string" &&
      !jumpToConstraint?.includes(result.jumpTo as JumpToTarget)
    ) {
      const constraint = this.name?.startsWith("BeforeModelNode_")
        ? "beforeModelJumpTo"
        : "afterModelJumpTo";
      const suggestion =
        jumpToConstraint && jumpToConstraint.length > 0
          ? `must be one of: ${jumpToConstraint?.join(", ")}.`
          : `no ${constraint} defined in middleware ${this.middleware.name}.`;
      throw new Error(`Invalid jump target: ${result.jumpTo}, ${suggestion}.`);
    }

    const jumpTo = parseJumpToTarget(result.jumpTo as string);

    /**
     * If result is a control action, handle it
     */
    if (typeof result === "object" && "type" in result) {
      // Handle control actions
      if (result.type === "terminate") {
        if (result.error) {
          throw result.error;
        }
        return {
          ...state,
          ...(result.result || {}),
          jumpTo,
        };
      }

      throw new Error(`Invalid control action: ${JSON.stringify(result)}`);
    }

    /**
     * If result is a state update, merge it with current state
     */
    return { ...state, ...result, jumpTo };
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
