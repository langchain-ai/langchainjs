/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod/v3";
import { LangGraphRunnableConfig, Command } from "@langchain/langgraph";
import { interopParse } from "@langchain/core/utils/types";

import { RunnableCallable, RunnableCallableArgs } from "../RunnableCallable.js";
import type { JumpToTarget } from "../constants.js";
import type { Runtime, PrivateState } from "../runtime.js";
import type { AgentMiddleware, MiddlewareResult } from "../middleware/types.js";
import { derivePrivateState, parseJumpToTarget } from "./utils.js";

/**
 * Named class for context objects to provide better error messages
 */
class AgentContext {}
class AgentRuntime {}

type NodeOutput<TStateSchema extends Record<string, any>> =
  | TStateSchema
  | Command<any, TStateSchema, string>;

export interface MiddlewareNodeOptions {
  getPrivateState: () => PrivateState;
}

export abstract class MiddlewareNode<
  TStateSchema extends Record<string, any>,
  TContextSchema extends Record<string, any>
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
    const runtime: Runtime<TContextSchema> = {
      context: filteredContext,
      writer: config?.writer,
      interrupt: config?.interrupt,
      signal: config?.signal,
      ...this.#options.getPrivateState(),
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
    delete result?._privateState;

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
      jumpToConstraint = this.middleware.beforeAgentJumpTo;
      constraint = "beforeAgentJumpTo";
    } else if (this.name?.startsWith("BeforeModelNode_")) {
      jumpToConstraint = this.middleware.beforeModelJumpTo;
      constraint = "beforeModelJumpTo";
    } else if (this.name?.startsWith("AfterAgentNode_")) {
      jumpToConstraint = this.middleware.afterAgentJumpTo;
      constraint = "afterAgentJumpTo";
    } else if (this.name?.startsWith("AfterModelNode_")) {
      jumpToConstraint = this.middleware.afterModelJumpTo;
      constraint = "afterModelJumpTo";
    }

    if (
      typeof result.jumpTo === "string" &&
      !jumpToConstraint?.includes(result.jumpTo as JumpToTarget)
    ) {
      const suggestion =
        jumpToConstraint && jumpToConstraint.length > 0
          ? `must be one of: ${jumpToConstraint?.join(", ")}.`
          : constraint
          ? `no ${constraint} defined in middleware ${this.middleware.name}.`
          : "";
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
