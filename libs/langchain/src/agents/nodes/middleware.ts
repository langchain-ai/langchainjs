/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod/v4";
import { LangGraphRunnableConfig, Command } from "@langchain/langgraph";
import { interopParse } from "@langchain/core/utils/types";

import { RunnableCallable, RunnableCallableArgs } from "../RunnableCallable.js";
import type { JumpToTarget } from "../constants.js";
import type { Runtime } from "../runtime.js";
import type { AgentMiddleware, MiddlewareResult } from "../middleware/types.js";
import { derivePrivateState } from "./utils.js";
import { getHookConstraint } from "../middleware/utils.js";

/**
 * Named class for context objects to provide better error messages
 */
class AgentContext {}
class AgentRuntime {}

type NodeOutput<TStateSchema extends Record<string, any>> =
  | TStateSchema
  | Command<any, TStateSchema, string>;

export interface MiddlewareNodeOptions {
  getState: () => Record<string, unknown>;
}

export abstract class MiddlewareNode<
  TStateSchema extends Record<string, any>,
  TContextSchema extends Record<string, any>,
> extends RunnableCallable<TStateSchema, NodeOutput<TStateSchema>> {
  #options: MiddlewareNodeOptions;

  abstract middleware: AgentMiddleware<
    z.ZodObject<z.ZodRawShape>,
    z.ZodObject<z.ZodRawShape>
  >;

  constructor(
    fields: RunnableCallableArgs<TStateSchema, NodeOutput<TStateSchema>>,
    options: MiddlewareNodeOptions
  ) {
    super(fields);
    this.#options = options;
  }

  abstract runHook(
    state: TStateSchema,
    config?: Runtime<TContextSchema>
  ): Promise<MiddlewareResult<TStateSchema>> | MiddlewareResult<TStateSchema>;

  async invokeMiddleware(
    invokeState: TStateSchema,
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

    const state: TStateSchema = {
      ...this.#options.getState(),
      ...invokeState,
      /**
       * don't overwrite possible outdated messages from other middleware nodes
       */
      messages: invokeState.messages,
    };

    /**
     * ToDo: implement later
     */
    const runtime: Runtime<TContextSchema> = {
      context: filteredContext,
      writer: config?.writer,
      interrupt: config?.interrupt,
      signal: config?.signal,
    };

    const result = await this.runHook(
      state,
      /**
       * assign runtime and context values into empty named class
       * instances to create a better error message.
       */
      Object.freeze(
        Object.assign(new AgentRuntime(), {
          ...runtime,
          context: Object.freeze(
            Object.assign(new AgentContext(), filteredContext)
          ),
        })
      )
    );

    /**
     * If result is undefined, return current state
     */
    if (!result) {
      return { ...state, jumpTo: undefined };
    }

    /**
     * Verify that the jump target is allowed for the middleware
     */
    let jumpToConstraint: JumpToTarget[] | undefined;
    let constraint: string | undefined;

    if (this.name?.startsWith("BeforeAgentNode_")) {
      jumpToConstraint = getHookConstraint(this.middleware.beforeAgent);
      constraint = "beforeAgent.canJumpTo";
    } else if (this.name?.startsWith("BeforeModelNode_")) {
      jumpToConstraint = getHookConstraint(this.middleware.beforeModel);
      constraint = "beforeModel.canJumpTo";
    } else if (this.name?.startsWith("AfterAgentNode_")) {
      jumpToConstraint = getHookConstraint(this.middleware.afterAgent);
      constraint = "afterAgent.canJumpTo";
    } else if (this.name?.startsWith("AfterModelNode_")) {
      jumpToConstraint = getHookConstraint(this.middleware.afterModel);
      constraint = "afterModel.canJumpTo";
    }

    if (
      typeof result.jumpTo === "string" &&
      !jumpToConstraint?.includes(result.jumpTo as JumpToTarget)
    ) {
      const suggestion =
        jumpToConstraint && jumpToConstraint.length > 0
          ? `must be one of: ${jumpToConstraint?.join(", ")}.`
          : constraint
            ? `no ${constraint} defined in middleware ${this.middleware.name}`
            : "";
      throw new Error(`Invalid jump target: ${result.jumpTo}, ${suggestion}.`);
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
        return {
          ...state,
          ...(result.result || {}),
          jumpTo: result.jumpTo,
        };
      }

      throw new Error(`Invalid control action: ${JSON.stringify(result)}`);
    }

    /**
     * If result is a state update, merge it with current state
     */
    return { ...state, ...result, jumpTo: result.jumpTo };
  }

  get nodeOptions() {
    return {
      input: derivePrivateState(this.middleware.stateSchema),
    };
  }
}
