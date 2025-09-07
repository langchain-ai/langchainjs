import { z } from "zod";
import { RunnableConfig } from "@langchain/core/runnables";
import { RunnableCallable } from "../../RunnableCallable.js";
import { AgentMiddleware, CreateAgentParams, Runtime } from "../types.js";
import { ModelRequest, AgentBuiltInState } from "../types.js";
import { initChatModel } from "../../../chat_models/universal.js";
import type { LanguageModelLike } from "@langchain/core/language_models/base";

interface PrepareModelRequestNodeOptions {
  middlewares: readonly AgentMiddleware<any, any, any>[];
  llm?: CreateAgentParams<any, any>["llm"];
  model?: CreateAgentParams<any, any>["model"];
}

/**
 * Node that executes prepareModelRequest hooks from all middlewares.
 * This node runs after all beforeModel nodes and before the AgentNode.
 */
export class PrepareModelRequestNode extends RunnableCallable<any, any> {
  #options: PrepareModelRequestNodeOptions;

  static nodeOptions = {
    /**
     * define private state for PrepareModelRequestNode
     */
    input: z.object({
      /**
       * all middlewares can access the same `__preparedModelOptions` object
       */
      __preparedModelOptions: z.custom<ModelRequest>(),
    }),
  };

  constructor(options: PrepareModelRequestNodeOptions) {
    super({
      func: async (state: any, config?: RunnableConfig) => {
        return this.#invoke(state, config);
      },
      name: "prepare_model_request",
    });
    this.#options = options;
  }

  async #deriveModel(
    state: any,
    config?: RunnableConfig
  ): Promise<LanguageModelLike | undefined> {
    if (this.#options.model) {
      if (typeof this.#options.model === "string") {
        return initChatModel(this.#options.model);
      }
      throw new Error("`model` option must be a string.");
    }

    const model = this.#options.llm;
    if (typeof model === "function") {
      // Create AgentRuntime from config
      const runtime = {
        context: config?.configurable?.context || {},
        store: config?.configurable?.store,
      };
      return model(state, runtime);
    }
    if (model) {
      return model;
    }

    return undefined;
  }

  async #invoke(state: any, config?: RunnableConfig): Promise<any> {
    // If no middlewares, return state unchanged
    if (!this.#options.middlewares || this.#options.middlewares.length === 0) {
      return state;
    }

    // Derive the model
    const model = await this.#deriveModel(state, config);
    if (!model) {
      // If no model can be derived, skip prepare hooks
      return state;
    }

    // Prepare the call options
    const preparedCallOptions: ModelRequest = {
      model,
      messages: state.messages,
      /**
       * Todo: add tools to the prepared call
       */
      tools: [],
    };

    // Execute prepareModelRequest hooks
    const preparedOptions = await this.#executePrepareCallHooks(
      preparedCallOptions,
      state,
      config
    );

    // Store the prepared options in the state for the AgentNode to use
    return {
      __preparedModelOptions: preparedOptions,
    };
  }

  /**
   * Helper function to execute prepareModelRequest hooks from all middlewares.
   * This is used within AgentNode before the model is invoked.
   */
  async #executePrepareCallHooks(
    options: ModelRequest,
    state: AgentBuiltInState,
    config?: RunnableConfig
  ): Promise<ModelRequest> {
    let currentOptions = { ...options };
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

    // Execute prepareModelRequest hooks in order
    for (const middleware of this.#options.middlewares) {
      if (middleware.prepareModelRequest) {
        const result = await middleware.prepareModelRequest(
          currentOptions,
          state,
          runtime
        );
        if (result) {
          currentOptions = { ...currentOptions, ...result };
        }
      }
    }

    return currentOptions;
  }
}
