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
  type GetStateOptions,
} from "@langchain/langgraph";
import type { CheckpointListOptions } from "@langchain/langgraph-checkpoint";
import { ToolMessage, AIMessage } from "@langchain/core/messages";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import type { RunnableConfig } from "@langchain/core/runnables";

import { createAgentAnnotationConditional } from "./annotation.js";
import { isClientTool } from "./utils.js";

import { AgentNode } from "./nodes/AgentNode.js";
import { ToolNode } from "./nodes/ToolNode.js";
import { BeforeModelNode } from "./nodes/BeforeModalNode.js";
import { AfterModelNode } from "./nodes/AfterModalNode.js";
import {
  initializeMiddlewareStates,
  parseJumpToTarget,
} from "./nodes/utils.js";

import type { ClientTool, ServerTool, WithStateGraphNodes } from "./types.js";

import type {
  CreateAgentParams,
  AgentMiddleware,
  InferMiddlewareStates,
  InferMiddlewareInputStates,
  BuiltInState,
  InferMiddlewareContextInputs,
  InferContextInput,
  InvokeConfiguration,
  StreamConfiguration,
  JumpTo,
  UserInput,
  PrivateState,
} from "./types.js";

import {
  type AnyAnnotationRoot,
  type ToAnnotationRoot,
  type ResponseFormatUndefined,
} from "./annotation.js";

// Helper type to get the state definition with middleware states
type MergedAgentState<
  StructuredResponseFormat extends
    | Record<string, any>
    | ResponseFormatUndefined,
  TMiddleware extends readonly AgentMiddleware<any, any, any>[]
> = (StructuredResponseFormat extends ResponseFormatUndefined
  ? Omit<BuiltInState, "jumpTo">
  : Omit<BuiltInState, "jumpTo"> & {
      structuredResponse: StructuredResponseFormat;
    }) &
  InferMiddlewareStates<TMiddleware>;

type InvokeStateParameter<
  TMiddleware extends readonly AgentMiddleware<any, any, any>[]
> =
  | (UserInput & InferMiddlewareInputStates<TMiddleware>)
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
  TMiddleware extends readonly AgentMiddleware<
    any,
    any,
    any
  >[] = readonly AgentMiddleware<any, any, any>[]
> {
  #graph: AgentGraph<StructuredResponseFormat, ContextSchema, TMiddleware>;

  #toolBehaviorVersion: "v1" | "v2" = "v2";

  #agentNode: AgentNode<any, AnyAnnotationRoot>;

  constructor(
    public options: CreateAgentParams<StructuredResponseFormat, ContextSchema>
  ) {
    this.#toolBehaviorVersion = options.version ?? this.#toolBehaviorVersion;

    /**
     * define complete list of tools based on options and middleware
     */
    const middlewareTools = (this.options.middleware
      ?.filter((m) => m.tools)
      .flatMap((m) => m.tools) ?? []) as (ClientTool | ServerTool)[];
    const toolClasses = [
      ...((Array.isArray(options.tools)
        ? options.tools
        : options.tools?.tools) ?? []),
      ...middlewareTools,
    ];

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
    const beforeModelNodes: {
      index: number;
      name: string;
      allowed?: string[];
    }[] = [];
    const afterModelNodes: {
      index: number;
      name: string;
      allowed?: string[];
    }[] = [];
    const modifyModelRequestHookMiddleware: [
      AgentMiddleware,
      /**
       * ToDo: better type to get the state of middleware
       */
      () => any
    ][] = [];
    const retryModelRequestHookMiddleware: [
      AgentMiddleware,
      /**
       * ToDo: better type to get the state of middleware
       */
      () => any
    ][] = [];

    this.#agentNode = new AgentNode({
      model: this.options.model,
      systemPrompt: this.options.systemPrompt,
      includeAgentName: this.options.includeAgentName,
      name: this.options.name,
      responseFormat: this.options.responseFormat,
      middleware: this.options.middleware,
      toolClasses,
      shouldReturnDirect,
      signal: this.options.signal,
      modifyModelRequestHookMiddleware,
      retryModelRequestHookMiddleware,
    });

    const middlewareNames = new Set<string>();
    const middleware = this.options.middleware ?? [];
    for (let i = 0; i < middleware.length; i++) {
      let beforeModelNode: BeforeModelNode | undefined;
      let afterModelNode: AfterModelNode | undefined;
      const m = middleware[i];
      if (middlewareNames.has(m.name)) {
        throw new Error(`Middleware ${m.name} is defined multiple times`);
      }

      middlewareNames.add(m.name);
      if (m.beforeModel) {
        beforeModelNode = new BeforeModelNode(m, {
          getPrivateState: () => this.#agentNode.getState()._privateState,
        });
        const name = `${m.name}.before_model`;
        beforeModelNodes.push({
          index: i,
          name,
          allowed: m.beforeModelJumpTo,
        });
        allNodeWorkflows.addNode(
          name,
          beforeModelNode,
          beforeModelNode.nodeOptions
        );
      }
      if (m.afterModel) {
        afterModelNode = new AfterModelNode(m, {
          getPrivateState: () => this.#agentNode.getState()._privateState,
        });
        const name = `${m.name}.after_model`;
        afterModelNodes.push({
          index: i,
          name,
          allowed: m.afterModelJumpTo,
        });
        allNodeWorkflows.addNode(
          name,
          afterModelNode,
          afterModelNode.nodeOptions
        );
      }

      if (m.modifyModelRequest) {
        modifyModelRequestHookMiddleware.push([
          m,
          () => ({
            ...beforeModelNode?.getState(),
            ...afterModelNode?.getState(),
          }),
        ]);
      }

      if (m.retryModelRequest) {
        retryModelRequestHookMiddleware.push([
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
      this.#agentNode,
      AgentNode.nodeOptions
    );

    /**
     * add single tool node for all tools
     */
    if (toolClasses.filter(isClientTool).length > 0) {
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

    // Connect beforeModel nodes; add conditional routing ONLY if allowed jumps are specified
    for (let i = 0; i < beforeModelNodes.length; i++) {
      const node = beforeModelNodes[i];
      const current = node.name;
      const isLast = i === beforeModelNodes.length - 1;
      const nextDefault = isLast
        ? "model_request"
        : beforeModelNodes[i + 1].name;

      if (node.allowed && node.allowed.length > 0) {
        const hasTools = toolClasses.filter(isClientTool).length > 0;
        const allowedMapped = node.allowed
          .map((t) => parseJumpToTarget(t))
          .filter((dest) => dest !== "tools" || hasTools);
        const destinations = Array.from(
          new Set([nextDefault, ...allowedMapped])
        ) as ("tools" | "model_request" | typeof END)[];

        allNodeWorkflows.addConditionalEdges(
          current,
          this.#createBeforeModelRouter(
            toolClasses.filter(isClientTool),
            nextDefault
          ),
          destinations
        );
      } else {
        allNodeWorkflows.addEdge(current, nextDefault);
      }
    }

    // Connect agent to last afterModel node (for reverse order execution)
    const lastAfterModelNode = afterModelNodes.at(-1);
    if (afterModelNodes.length > 0 && lastAfterModelNode) {
      allNodeWorkflows.addEdge("model_request", lastAfterModelNode.name);
    } else {
      // If no afterModel nodes, connect model_request directly to model paths
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

    // Connect afterModel nodes in reverse sequence; add conditional routing ONLY if allowed jumps are specified per node
    for (let i = afterModelNodes.length - 1; i > 0; i--) {
      const node = afterModelNodes[i];
      const current = node.name;
      const nextDefault = afterModelNodes[i - 1].name;

      if (node.allowed && node.allowed.length > 0) {
        const hasTools = toolClasses.filter(isClientTool).length > 0;
        const allowedMapped = node.allowed
          .map((t) => parseJumpToTarget(t))
          .filter((dest) => dest !== "tools" || hasTools);
        const destinations = Array.from(
          new Set([nextDefault, ...allowedMapped])
        ) as ("tools" | "model_request" | typeof END)[];

        allNodeWorkflows.addConditionalEdges(
          current,
          this.#createAfterModelSequenceRouter(
            toolClasses.filter(isClientTool),
            node.allowed,
            nextDefault
          ),
          destinations
        );
      } else {
        allNodeWorkflows.addEdge(current, nextDefault);
      }
    }

    // Connect first afterModel node (last to execute) to model paths with jumpTo support
    if (afterModelNodes.length > 0) {
      const firstAfterModel = afterModelNodes[0];
      const firstAfterModelNode = firstAfterModel.name;
      const modelPaths = this.#getModelPaths(
        toolClasses.filter(isClientTool),
        true
      ).filter(
        (p) => p !== "tools" || toolClasses.filter(isClientTool).length > 0
      );

      const allowJump = Boolean(
        firstAfterModel.allowed && firstAfterModel.allowed.length > 0
      );

      const destinations = modelPaths;

      allNodeWorkflows.addConditionalEdges(
        firstAfterModelNode,
        this.#createAfterModelRouter(
          toolClasses.filter(isClientTool),
          allowJump
        ),
        destinations
      );
    }

    /**
     * add edges for tools node
     */
    if (toolClasses.filter(isClientTool).length > 0) {
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
   * @param includeModelRequest whether to include "model_request" as a valid path (for jumpTo routing)
   * @returns list of possible edge destinations
   */
  #getModelPaths(
    toolClasses: (ClientTool | ServerTool)[],
    includeModelRequest: boolean = false
  ): ("tools" | "model_request" | typeof END)[] {
    const paths: ("tools" | "model_request" | typeof END)[] = [];
    if (toolClasses.length > 0) {
      paths.push("tools");
    }

    if (includeModelRequest) {
      paths.push("model_request");
    }

    paths.push(END);

    return paths;
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
   * Create routing function for model node conditional edges.
   */
  #createModelRouter() {
    /**
     * determine if the agent should continue or not
     */
    return (state: BuiltInState) => {
      const messages = state.messages;
      const lastMessage = messages.at(-1);

      if (
        !AIMessage.isInstance(lastMessage) ||
        !lastMessage.tool_calls ||
        lastMessage.tool_calls.length === 0
      ) {
        return END;
      }

      // Check if all tool calls are for structured response extraction
      const hasOnlyStructuredResponseCalls = lastMessage.tool_calls.every(
        (toolCall) => toolCall.name.startsWith("extract-")
      );

      if (hasOnlyStructuredResponseCalls) {
        // If all tool calls are for structured response extraction, go to END
        // The AgentNode will handle these internally and return the structured response
        return END;
      }

      /**
       * The tool node processes a single message.
       */
      if (this.#toolBehaviorVersion === "v1") {
        return "tools";
      }

      /**
       * Route to tools node (filter out any structured response tool calls)
       */
      const regularToolCalls = lastMessage.tool_calls.filter(
        (toolCall) => !toolCall.name.startsWith("extract-")
      );

      if (regularToolCalls.length === 0) {
        return END;
      }

      return regularToolCalls.map(
        (toolCall) => new Send("tools", { ...state, lg_tool_call: toolCall })
      );
    };
  }

  /**
   * Create routing function for jumpTo functionality after afterModel hooks.
   *
   * This router checks if the `jumpTo` property is set in the state after afterModel middleware
   * execution. If set, it routes to the specified target ("model_request" or "tools").
   * If not set, it falls back to the normal model routing logic for afterModel context.
   *
   * The jumpTo property is automatically cleared after use to prevent infinite loops.
   *
   * @param toolClasses - Available tool classes for validation
   * @returns Router function that handles jumpTo logic and normal routing
   */
  #createAfterModelRouter(
    toolClasses: (ClientTool | ServerTool)[],
    allowJump: boolean
  ) {
    const hasStructuredResponse = Boolean(this.options.responseFormat);

    return (state: Omit<BuiltInState, "jumpTo"> & { jumpTo?: JumpTo }) => {
      // First, check if we just processed a structured response
      // If so, ignore any existing jumpTo and go to END
      const messages = state.messages;
      const lastMessage = messages.at(-1);
      if (
        AIMessage.isInstance(lastMessage) &&
        (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0)
      ) {
        return END;
      }

      // Check if jumpTo is set in the state and allowed
      if (allowJump && state.jumpTo) {
        if (state.jumpTo === END) {
          return END;
        }
        if (state.jumpTo === "tools") {
          // If trying to jump to tools but no tools are available, go to END
          if (toolClasses.length === 0) {
            return END;
          }
          return new Send("tools", { ...state, jumpTo: undefined });
        }
        // destination === "model_request"
        return new Send("model_request", { ...state, jumpTo: undefined });
      }

      // check if there are pending tool calls
      const toolMessages = messages.filter(ToolMessage.isInstance);
      const lastAiMessage = messages.filter(AIMessage.isInstance).at(-1);
      const pendingToolCalls = lastAiMessage?.tool_calls?.filter(
        (call) => !toolMessages.some((m) => m.tool_call_id === call.id)
      );
      if (pendingToolCalls && pendingToolCalls.length > 0) {
        return pendingToolCalls.map(
          (toolCall) => new Send("tools", { ...state, lg_tool_call: toolCall })
        );
      }

      // if we exhausted all tool calls, but still have no structured response tool calls,
      // go back to model_request
      const hasStructuredResponseCalls = lastAiMessage?.tool_calls?.some(
        (toolCall) => toolCall.name.startsWith("extract-")
      );

      if (
        pendingToolCalls &&
        pendingToolCalls.length === 0 &&
        !hasStructuredResponseCalls &&
        hasStructuredResponse
      ) {
        return "model_request";
      }

      if (
        !AIMessage.isInstance(lastMessage) ||
        !lastMessage.tool_calls ||
        lastMessage.tool_calls.length === 0
      ) {
        return END;
      }

      // Check if all tool calls are for structured response extraction
      const hasOnlyStructuredResponseCalls = lastMessage.tool_calls.every(
        (toolCall) => toolCall.name.startsWith("extract-")
      );

      // Check if there are any regular tool calls (non-structured response)
      const hasRegularToolCalls = lastMessage.tool_calls.some(
        (toolCall) => !toolCall.name.startsWith("extract-")
      );

      if (hasOnlyStructuredResponseCalls || !hasRegularToolCalls) {
        return END;
      }

      /**
       * For routing from afterModel nodes, always use simple string paths
       * The Send API is handled at the model_request node level
       */
      return "tools";
    };
  }

  /**
   * Router for afterModel sequence nodes (connecting later middlewares to earlier ones),
   * honoring allowed jump targets and defaulting to the next node.
   */
  #createAfterModelSequenceRouter(
    toolClasses: (ClientTool | ServerTool)[],
    allowed: string[],
    nextDefault: string
  ) {
    const allowedSet = new Set(allowed.map((t) => parseJumpToTarget(t)));
    return (state: BuiltInState) => {
      if (state.jumpTo) {
        const dest = parseJumpToTarget(state.jumpTo);
        if (dest === END && allowedSet.has(END)) {
          return END;
        }
        if (dest === "tools" && allowedSet.has("tools")) {
          if (toolClasses.length === 0) return END;
          return new Send("tools", { ...state, jumpTo: undefined });
        }
        if (dest === "model_request" && allowedSet.has("model_request")) {
          return new Send("model_request", { ...state, jumpTo: undefined });
        }
      }
      return nextDefault as any;
    };
  }

  /**
   * Create routing function for jumpTo functionality after beforeModel hooks.
   * Falls back to the default next node if no jumpTo is present.
   */
  #createBeforeModelRouter(
    toolClasses: (ClientTool | ServerTool)[],
    nextDefault: string
  ) {
    return (state: BuiltInState) => {
      if (!state.jumpTo) {
        return nextDefault;
      }
      const destination = parseJumpToTarget(state.jumpTo);
      if (destination === END) {
        return END;
      }
      if (destination === "tools") {
        if (toolClasses.length === 0) {
          return END;
        }
        return new Send("tools", { ...state, jumpTo: undefined });
      }
      // destination === "model_request"
      return new Send("model_request", { ...state, jumpTo: undefined });
    };
  }

  /**
   * Initialize middleware states if not already present in the input state.
   */
  async #initializeMiddlewareStates(
    state: InvokeStateParameter<TMiddleware>
  ): Promise<InvokeStateParameter<TMiddleware>> {
    if (
      !this.options.middleware ||
      this.options.middleware.length === 0 ||
      state instanceof Command ||
      !state
    ) {
      return state;
    }

    const defaultStates = await initializeMiddlewareStates(
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
   * Populate the private state of the agent node from the previous state.
   */
  async #populatePrivateState(config?: RunnableConfig) {
    /**
     * not needed if thread_id is not provided
     */
    if (!config?.configurable?.thread_id) {
      return;
    }
    const prevState = (await this.#graph.getState(config as any)) as {
      values: {
        _privateState: PrivateState;
      };
    };

    /**
     * not need if state is empty
     */
    if (!prevState.values._privateState) {
      return;
    }

    this.#agentNode.setState({
      structuredResponse: undefined,
      _privateState: prevState.values._privateState,
    });
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
  async invoke(
    state: InvokeStateParameter<TMiddleware>,
    config?: InvokeConfiguration<
      InferContextInput<ContextSchema> &
        InferMiddlewareContextInputs<TMiddleware>
    >
  ) {
    type FullState = MergedAgentState<StructuredResponseFormat, TMiddleware>;
    const initializedState = await this.#initializeMiddlewareStates(state);
    await this.#populatePrivateState(config);

    return this.#graph.invoke(
      initializedState,
      config as unknown as InferContextInput<ContextSchema> &
        InferMiddlewareContextInputs<TMiddleware>
    ) as Promise<FullState>;
  }

  /**
   * Executes the agent with streaming, returning an async iterable of state updates as they occur.
   *
   * This method runs the agent's workflow similar to `invoke`, but instead of waiting for
   * completion, it streams high-level state updates in real-time. This allows you to:
   * - Display intermediate results to users as they're generated
   * - Monitor the agent's progress through each step
   * - React to state changes as nodes complete
   *
   * For more granular event-level streaming (like individual LLM tokens), use `streamEvents` instead.
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
   * @returns A Promise that resolves to an IterableReadableStream of state updates.
   *          Each update contains the current state after a node completes.
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
   * for await (const chunk of stream) {
   *   console.log(chunk); // State update from each node
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
    const initializedState = await this.#initializeMiddlewareStates(state);
    return this.#graph.stream(initializedState, config as Record<string, any>);
  }

  /**
   * Executes the agent with low-level event streaming, returning detailed events as they occur.
   *
   * This method provides fine-grained control over streaming, emitting events for every
   * operation during execution. This is useful when you need to:
   * - Stream individual LLM tokens as they're generated
   * - Monitor detailed execution flow with timing information
   * - Handle specific event types (model start/end, tool calls, etc.)
   * - Debug or trace agent behavior at a granular level
   *
   * For simpler state-based streaming, use `stream` instead.
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
   * @param config.streamMode - The streaming mode for the agent execution, see more in {@link https://docs.langchain.com/oss/javascript/langgraph/streaming#supported-stream-modes | Supported stream modes}.
   *
   * @param streamOptions - Additional streaming options (passed to LangGraph's streamEvents).
   *
   * @returns An IterableReadableStream of detailed events including:
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
   * const stream = await agent.streamEvents({
   *   messages: [{ role: "human", content: "What's 2+2 and the weather in NYC?" }]
   * }, {
   *   version: "v2"
   * });
   *
   * for await (const event of stream) {
   *   if (event.event === "on_chat_model_stream") {
   *     process.stdout.write(event.data.chunk.content); // Stream tokens
   *   }
   * }
   * ```
   */
  async streamEvents(
    state: InvokeStateParameter<TMiddleware>,
    config?: StreamConfiguration<
      InferContextInput<ContextSchema> &
        InferMiddlewareContextInputs<TMiddleware>
    > & { version?: "v1" | "v2" },
    streamOptions?: any
  ): Promise<IterableReadableStream<any>> {
    const initializedState = await this.#initializeMiddlewareStates(state);
    await this.#populatePrivateState(config);
    return this.#graph.streamEvents(
      initializedState,
      {
        ...(config as any),
        version: config?.version ?? "v2",
      },
      streamOptions
    ) as IterableReadableStream<any>;
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

  /**
   * The following are internal methods to enable support for LangGraph Platform.
   * They are not part of the createAgent public API.
   *
   * Note: we intentionally return as `never` to avoid type errors due to type inference.
   */

  /**
   * @internal
   */
  getGraphAsync(config?: RunnableConfig) {
    return this.#graph.getGraphAsync(config) as never;
  }
  /**
   * @internal
   */
  getState(config: RunnableConfig, options?: GetStateOptions) {
    return this.#graph.getState(config, options) as never;
  }
  /**
   * @internal
   */
  getStateHistory(config: RunnableConfig, options?: CheckpointListOptions) {
    return this.#graph.getStateHistory(config, options) as never;
  }
  /**
   * @internal
   */
  getSubgraphs(namespace?: string, recurse?: boolean) {
    return this.#graph.getSubgraphs(namespace, recurse) as never;
  }
  /**
   * @internal
   */
  getSubgraphAsync(namespace?: string, recurse?: boolean) {
    return this.#graph.getSubgraphsAsync(namespace, recurse) as never;
  }
}
