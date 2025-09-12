/* eslint-disable no-instanceof/no-instanceof */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { InteropZodObject } from "@langchain/core/utils/types";

import {
  AnnotationRoot,
  StateGraph,
  END,
  START,
  Send,
  Command,
  CompiledStateGraph,
} from "@langchain/langgraph";
import { ToolMessage, AIMessage } from "@langchain/core/messages";
import { IterableReadableStream } from "@langchain/core/utils/stream";

import { createAgentAnnotationConditional } from "./annotation.js";
import { isClientTool, validateLLMHasNoBoundTools } from "../utils.js";

import { AgentNode } from "./nodes/AgentNode.js";
import { ToolNode } from "../nodes/ToolNode.js";
import { BeforeModelNode } from "./nodes/BeforeModalNode.js";
import { AfterModelNode } from "./nodes/AfterModalNode.js";
import { initializeMiddlewareStates } from "./nodes/utils.js";

import type { ClientTool, ServerTool, WithStateGraphNodes } from "../types.js";

import {
  CreateAgentParams,
  AgentMiddleware,
  InferMiddlewareStates,
  InferMiddlewareInputStates,
  BuiltInState,
  InferMiddlewareContextInputs,
  InferContextInput,
  InvokeConfiguration,
  StreamConfiguration,
} from "./types.js";

import {
  type AnyAnnotationRoot,
  type ToAnnotationRoot,
} from "../annotation.js";
import type { ResponseFormatUndefined } from "../responses.js";

// Helper type to get the state definition with middleware states
type MergedAgentState<
  StructuredResponseFormat extends
    | Record<string, any>
    | ResponseFormatUndefined,
  TMiddleware extends readonly AgentMiddleware<any, any, any>[]
> = (StructuredResponseFormat extends ResponseFormatUndefined
  ? BuiltInState
  : BuiltInState & { structuredResponse: StructuredResponseFormat }) &
  InferMiddlewareStates<TMiddleware>;

type InvokeStateParameter<
  TMiddleware extends readonly AgentMiddleware<any, any, any>[]
> =
  | (BuiltInState & InferMiddlewareInputStates<TMiddleware>)
  | Command<any, any, any>
  | null;

type AgentGraph<
  StructuredResponseFormat extends
    | Record<string, any>
    | ResponseFormatUndefined = Record<string, any>,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddleware extends readonly AgentMiddleware<any, any, any>[] = []
> = CompiledStateGraph<
  any,
  any,
  any,
  any,
  MergedAgentState<StructuredResponseFormat, TMiddleware>,
  ToAnnotationRoot<ContextSchema>["spec"],
  unknown
>;

export class ReactAgent<
  StructuredResponseFormat extends
    | Record<string, any>
    | ResponseFormatUndefined = Record<string, any>,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddleware extends readonly AgentMiddleware<any, any, any>[] = []
> {
  #graph: AgentGraph<StructuredResponseFormat, ContextSchema, TMiddleware>;

  #toolBehaviorVersion: "v1" | "v2" = "v2";

  constructor(
    public options: CreateAgentParams<StructuredResponseFormat, ContextSchema>
  ) {
    this.#toolBehaviorVersion = options.version ?? this.#toolBehaviorVersion;

    /**
     * Check if the LLM already has bound tools and throw if it does.
     */
    if (options.llm && typeof options.llm !== "function") {
      validateLLMHasNoBoundTools(options.llm);
    }

    /**
     * validate that model and llm options are not provided together
     */
    if (options.llm && options.model) {
      throw new Error("Cannot provide both `model` and `llm` options.");
    }

    /**
     * validate that either model or llm option is provided
     */
    if (!options.llm && !options.model) {
      throw new Error(
        "Either `model` or `llm` option must be provided to create an agent."
      );
    }

    const toolClasses =
      (Array.isArray(options.tools) ? options.tools : options.tools?.tools) ??
      [];

    /**
     * If any of the tools are configured to return_directly after running,
     * our graph needs to check if these were called
     */
    const shouldReturnDirect = new Set(
      toolClasses
        .filter(isClientTool)
        .filter((tool) => "returnDirect" in tool && tool.returnDirect)
        .map((tool) => tool.name)
    );

    // Create a schema that merges agent base schema with middleware state schemas
    const schema = createAgentAnnotationConditional<
      StructuredResponseFormat,
      TMiddleware
    >(
      this.options.responseFormat !== undefined,
      this.options.middleware as TMiddleware
    );

    const workflow = new StateGraph(
      schema as AnnotationRoot<any>,
      this.options.contextSchema
    );

    const allNodeWorkflows = workflow as WithStateGraphNodes<
      "tools" | "model_request" | string,
      typeof workflow
    >;

    // Generate node names for middleware nodes that have hooks
    const beforeModelNodes: { index: number; name: string }[] = [];
    const afterModelNodes: { index: number; name: string }[] = [];
    const prepareModelRequestHookMiddleware: [
      AgentMiddleware,
      /**
       * ToDo: better type to get the state of middleware
       */
      () => any
    ][] = [];

    const middleware = this.options.middleware ?? [];
    for (let i = 0; i < middleware.length; i++) {
      let beforeModelNode: BeforeModelNode | undefined;
      let afterModelNode: AfterModelNode | undefined;
      const m = middleware[i];
      if (m.beforeModel) {
        beforeModelNode = new BeforeModelNode(m);
        const name = `before_model_${m.name}_${i}`;
        beforeModelNodes.push({
          index: i,
          name,
        });
        allNodeWorkflows.addNode(
          name,
          beforeModelNode,
          beforeModelNode.nodeOptions
        );
      }
      if (m.afterModel) {
        afterModelNode = new AfterModelNode(m);
        const name = `after_model_${m.name}_${i}`;
        afterModelNodes.push({
          index: i,
          name,
        });
        allNodeWorkflows.addNode(
          name,
          afterModelNode,
          afterModelNode.nodeOptions
        );
      }

      if (m.prepareModelRequest) {
        prepareModelRequestHookMiddleware.push([
          m,
          () => ({
            ...beforeModelNode?.getState(),
            ...afterModelNode?.getState(),
          }),
        ]);
      }
    }

    /**
     * Add Nodes
     */
    allNodeWorkflows.addNode(
      "model_request",
      new AgentNode({
        llm: this.options.llm,
        model: this.options.model,
        prompt: this.options.prompt,
        includeAgentName: this.options.includeAgentName,
        name: this.options.name,
        responseFormat: this.options.responseFormat,
        middleware: this.options.middleware,
        toolClasses,
        shouldReturnDirect,
        signal: this.options.signal,
        prepareModelRequestHookMiddleware,
      }),
      AgentNode.nodeOptions
    );

    /**
     * add single tool node for all tools
     */
    if (toolClasses.length > 0) {
      const toolNode = new ToolNode(toolClasses.filter(isClientTool), {
        signal: this.options.signal,
      });
      allNodeWorkflows.addNode("tools", toolNode);
    }

    /**
     * Add Edges
     */
    // Determine starting point based on what nodes exist
    if (beforeModelNodes.length > 0) {
      // If we have beforeModel nodes, start with the first one
      allNodeWorkflows.addEdge(START, beforeModelNodes[0].name);
    } else {
      // If no beforeModel nodes, go directly to agent
      allNodeWorkflows.addEdge(START, "model_request");
    }

    // Connect beforeModel nodes in sequence
    for (let i = 0; i < beforeModelNodes.length - 1; i++) {
      allNodeWorkflows.addEdge(
        beforeModelNodes[i].name,
        beforeModelNodes[i + 1].name
      );
    }

    // Connect last beforeModel node to agent
    const lastBeforeModelNode = beforeModelNodes.at(-1);
    if (beforeModelNodes.length > 0 && lastBeforeModelNode) {
      allNodeWorkflows.addEdge(lastBeforeModelNode.name, "model_request");
    }

    // Connect agent to last afterModel node (for reverse order execution)
    const lastAfterModelNode = afterModelNodes.at(-1);
    if (afterModelNodes.length > 0 && lastAfterModelNode) {
      allNodeWorkflows.addEdge("model_request", lastAfterModelNode.name);
    } else {
      const modelPaths = this.#getModelPaths(toolClasses.filter(isClientTool));
      if (modelPaths.length === 1) {
        allNodeWorkflows.addEdge("model_request", modelPaths[0]);
      } else {
        allNodeWorkflows.addConditionalEdges(
          "model_request",
          this.#createModelRouter(),
          modelPaths
        );
      }
    }

    // Connect afterModel nodes in reverse sequence
    for (let i = afterModelNodes.length - 1; i > 0; i--) {
      allNodeWorkflows.addEdge(
        afterModelNodes[i].name,
        afterModelNodes[i - 1].name
      );
    }

    // Connect first afterModel node (last to execute) to model paths
    if (afterModelNodes.length > 0) {
      const firstAfterModelNode = afterModelNodes[0].name;
      const modelPaths = this.#getModelPaths(toolClasses.filter(isClientTool));
      if (modelPaths.length === 1) {
        allNodeWorkflows.addEdge(firstAfterModelNode, modelPaths[0]);
      } else {
        allNodeWorkflows.addConditionalEdges(
          firstAfterModelNode,
          this.#createModelRouter(),
          modelPaths
        );
      }
    }

    /**
     * add edges for tools node
     */
    if (toolClasses.length > 0) {
      // Tools should return to first beforeModel node or agent
      let toolReturnTarget: string;
      if (beforeModelNodes.length > 0) {
        toolReturnTarget = beforeModelNodes[0].name;
      } else {
        toolReturnTarget = "model_request";
      }

      if (shouldReturnDirect.size > 0) {
        allNodeWorkflows.addConditionalEdges(
          "tools",
          this.#createToolsRouter(shouldReturnDirect),
          [toolReturnTarget, END]
        );
      } else {
        allNodeWorkflows.addEdge("tools", toolReturnTarget);
      }
    }

    /**
     * compile the graph
     */
    this.#graph = allNodeWorkflows.compile({
      checkpointer: this.options.checkpointer ?? this.options.checkpointSaver,
      interruptBefore: this.options.interruptBefore,
      interruptAfter: this.options.interruptAfter,
      store: this.options.store,
      name: this.options.name,
      description: this.options.description,
    }) as AgentGraph<StructuredResponseFormat, ContextSchema, TMiddleware>;
  }

  /**
   * Get the compiled {@link https://docs.langchain.com/oss/javascript/langgraph/use-graph-api | StateGraph}.
   */
  get graph(): AgentGraph<
    StructuredResponseFormat,
    ContextSchema,
    TMiddleware
  > {
    return this.#graph;
  }

  /**
   * Get possible edge destinations from model node.
   * @param toolClasses names of tools to call
   * @returns list of possible edge destinations
   */
  #getModelPaths(
    toolClasses: (ClientTool | ServerTool)[]
  ): ("tools" | typeof END)[] {
    const paths: ("tools" | typeof END)[] = [];
    if (toolClasses.length > 0) {
      paths.push("tools");
    }

    paths.push(END);

    return paths;
  }

  /**
   * Create routing function for model node conditional edges.
   */
  #createModelRouter() {
    /**
     * determine if the agent should continue or not
     */
    /**
     * ToDo: fix type
     */
    return (state: any) => {
      const messages = state.messages;
      const lastMessage = messages.at(-1);

      if (
        !AIMessage.isInstance(lastMessage) ||
        !lastMessage.tool_calls ||
        lastMessage.tool_calls.length === 0
      ) {
        return END;
      }

      /**
       * The tool node processes a single message.
       */
      if (this.#toolBehaviorVersion === "v1") {
        return "tools";
      }

      /**
       * Route to tools node
       */
      return lastMessage.tool_calls.map(
        (toolCall) => new Send("tools", { ...state, lg_tool_call: toolCall })
      );
    };
  }

  /**
   * Create routing function for tools node conditional edges.
   */
  #createToolsRouter(shouldReturnDirect: Set<string>) {
    /**
     * ToDo: fix type
     */
    return (state: any) => {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1];

      // Check if we just executed a returnDirect tool
      if (
        ToolMessage.isInstance(lastMessage) &&
        lastMessage.name &&
        shouldReturnDirect.has(lastMessage.name)
      ) {
        // If we have a response format, route to agent to generate structured response
        // Otherwise, return directly
        return this.options.responseFormat ? "model_request" : END;
      }

      // For non-returnDirect tools, always route back to agent
      return "model_request";
    };
  }

  /**
   * Initialize middleware states if not already present in the input state.
   */
  #initializeMiddlewareStates(
    state: InvokeStateParameter<TMiddleware>
  ): InvokeStateParameter<TMiddleware> {
    if (
      !this.options.middleware ||
      this.options.middleware.length === 0 ||
      state instanceof Command ||
      !state
    ) {
      return state;
    }

    const defaultStates = initializeMiddlewareStates(
      this.options.middleware,
      state
    );
    const updatedState = { ...state } as InvokeStateParameter<TMiddleware>;
    if (!updatedState) {
      return updatedState;
    }

    // Only add defaults for keys that don't exist in current state
    for (const [key, value] of Object.entries(defaultStates)) {
      if (!(key in updatedState)) {
        updatedState[key as keyof typeof updatedState] = value;
      }
    }

    return updatedState;
  }

  /**
   * Executes the agent with the given state and returns the final state after all processing.
   *
   * This method runs the agent's entire workflow synchronously, including:
   * - Processing the input messages through any configured middleware
   * - Calling the language model to generate responses
   * - Executing any tool calls made by the model
   * - Running all middleware hooks (beforeModel, afterModel, etc.)
   *
   * @param state - The initial state for the agent execution. Can be:
   *   - An object containing `messages` array and any middleware-specific state properties
   *   - A Command object for more advanced control flow
   *
   * @param config - Optional runtime configuration including:
   * @param config.context - The context for the agent execution.
   * @param config.configurable - LangGraph configuration options like `thread_id`, `run_id`, etc.
   * @param config.store - The store for the agent execution for persisting state, see more in {@link https://docs.langchain.com/oss/javascript/langgraph/memory#memory-storage | Memory storage}.
   * @param config.signal - An optional {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal | `AbortSignal`} for the agent execution.
   * @param config.recursionLimit - The recursion limit for the agent execution.
   *
   * @returns A Promise that resolves to the final agent state after execution completes.
   *          The returned state includes:
   *          - a `messages` property containing an array with all messages (input, AI responses, tool calls/results)
   *          - a `structuredResponse` property containing the structured response (if configured)
   *          - all state values defined in the middleware
   *
   * @example
   * ```typescript
   * const agent = new ReactAgent({
   *   llm: myModel,
   *   tools: [calculator, webSearch],
   *   responseFormat: z.object({
   *     weather: z.string(),
   *   }),
   * });
   *
   * const result = await agent.invoke({
   *   messages: [{ role: "human", content: "What's the weather in Paris?" }]
   * });
   *
   * console.log(result.structuredResponse.weather); // outputs: "It's sunny and 75°F."
   * ```
   */
  invoke(
    state: InvokeStateParameter<TMiddleware>,
    config?: InvokeConfiguration<
      InferContextInput<ContextSchema> &
        InferMiddlewareContextInputs<TMiddleware>
    >
  ) {
    type FullState = MergedAgentState<StructuredResponseFormat, TMiddleware>;
    const initializedState = this.#initializeMiddlewareStates(state);
    return this.#graph.invoke(
      initializedState,
      config as unknown as InferContextInput<ContextSchema> &
        InferMiddlewareContextInputs<TMiddleware>
    ) as Promise<FullState>;
  }

  /**
   * Executes the agent with streaming, returning an async iterable of events as they occur.
   *
   * This method runs the agent's workflow similar to `invoke`, but instead of waiting for
   * completion, it streams events in real-time. This allows you to:
   * - Display intermediate results to users as they're generated
   * - Monitor the agent's progress through each step
   * - Handle tool calls and results as they happen
   * - Update UI with streaming responses from the LLM
   *
   * @param state - The initial state for the agent execution. Can be:
   *   - An object containing `messages` array and any middleware-specific state properties
   *   - A Command object for more advanced control flow
   *
   * @param config - Optional runtime configuration including:
   * @param config.context - The context for the agent execution.
   * @param config.configurable - LangGraph configuration options like `thread_id`, `run_id`, etc.
   * @param config.store - The store for the agent execution for persisting state, see more in {@link https://docs.langchain.com/oss/javascript/langgraph/memory#memory-storage | Memory storage}.
   * @param config.signal - An optional {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal | `AbortSignal`} for the agent execution.
   * @param config.streamMode - The streaming mode for the agent execution, see more in {@link https://docs.langchain.com/oss/javascript/langgraph/streaming#supported-stream-modes | Supported stream modes}.
   * @param config.recursionLimit - The recursion limit for the agent execution.
   *
   * @returns A Promise that resolves to an IterableReadableStream of events.
   *          Events include:
   *          - `on_chat_model_start`: When the LLM begins processing
   *          - `on_chat_model_stream`: Streaming tokens from the LLM
   *          - `on_chat_model_end`: When the LLM completes
   *          - `on_tool_start`: When a tool execution begins
   *          - `on_tool_end`: When a tool execution completes
   *          - `on_chain_start`: When middleware chains begin
   *          - `on_chain_end`: When middleware chains complete
   *          - And other LangGraph v2 stream events
   *
   * @example
   * ```typescript
   * const agent = new ReactAgent({
   *   llm: myModel,
   *   tools: [calculator, webSearch]
   * });
   *
   * const stream = await agent.stream({
   *   messages: [{ role: "human", content: "What's 2+2 and the weather in NYC?" }]
   * });
   *
   * for await (const event of stream) {
   *   //
   * }
   * ```
   */
  async stream(
    state: InvokeStateParameter<TMiddleware>,
    config?: StreamConfiguration<
      InferContextInput<ContextSchema> &
        InferMiddlewareContextInputs<TMiddleware>
    >
  ): Promise<IterableReadableStream<any>> {
    const initializedState = this.#initializeMiddlewareStates(state);
    return this.#graph.streamEvents(initializedState, {
      ...config,
      version: "v2",
    } as any) as IterableReadableStream<any>;
  }

  /**
   * Visualize the graph as a PNG image.
   * @param params - Parameters for the drawMermaidPng method.
   * @param params.withStyles - Whether to include styles in the graph.
   * @param params.curveStyle - The style of the graph's curves.
   * @param params.nodeColors - The colors of the graph's nodes.
   * @param params.wrapLabelNWords - The maximum number of words to wrap in a node's label.
   * @param params.backgroundColor - The background color of the graph.
   * @returns PNG image as a buffer
   */
  async drawMermaidPng(params?: {
    withStyles?: boolean;
    curveStyle?: string;
    nodeColors?: Record<string, string>;
    wrapLabelNWords?: number;
    backgroundColor?: string;
  }) {
    const representation = await this.#graph.getGraphAsync();
    const image = await representation.drawMermaidPng(params);
    const arrayBuffer = await image.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    return buffer;
  }

  /**
   * Draw the graph as a Mermaid string.
   * @param params - Parameters for the drawMermaid method.
   * @param params.withStyles - Whether to include styles in the graph.
   * @param params.curveStyle - The style of the graph's curves.
   * @param params.nodeColors - The colors of the graph's nodes.
   * @param params.wrapLabelNWords - The maximum number of words to wrap in a node's label.
   * @param params.backgroundColor - The background color of the graph.
   * @returns Mermaid string
   */
  async drawMermaid(params?: {
    withStyles?: boolean;
    curveStyle?: string;
    nodeColors?: Record<string, string>;
    wrapLabelNWords?: number;
    backgroundColor?: string;
  }) {
    const representation = await this.#graph.getGraphAsync();
    return representation.drawMermaid(params);
  }
}
