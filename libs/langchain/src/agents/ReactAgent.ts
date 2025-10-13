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
  type LangGraphRunnableConfig,
} from "@langchain/langgraph";
import type { CheckpointListOptions } from "@langchain/langgraph-checkpoint";
import { ToolMessage, AIMessage } from "@langchain/core/messages";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import type { Runnable, RunnableConfig } from "@langchain/core/runnables";
import type { StreamEvent } from "@langchain/core/tracers/log_stream";
import type { ClientTool, ServerTool } from "@langchain/core/tools";
import type {
  PrivateState,
  AgentMiddleware,
  InferMiddlewareContextInputs,
  InferMiddlewareStates,
  InferMiddlewareInputStates,
} from "@langchain/core/middleware";

import { createAgentAnnotationConditional } from "./annotation.js";
import {
  isClientTool,
  validateLLMHasNoBoundTools,
  wrapToolCall,
} from "./utils.js";

import { AgentNode } from "./nodes/AgentNode.js";
import { ToolNode } from "./nodes/ToolNode.js";
import { BeforeAgentNode } from "./nodes/BeforeAgentNode.js";
import { BeforeModelNode } from "./nodes/BeforeModelNode.js";
import { AfterModelNode } from "./nodes/AfterModelNode.js";
import { AfterAgentNode } from "./nodes/AfterAgentNode.js";
import {
  initializeMiddlewareStates,
  parseJumpToTarget,
} from "./nodes/utils.js";

import type { WithStateGraphNodes } from "./types.js";

import type {
  CreateAgentParams,
  BuiltInState,
  JumpTo,
  UserInput,
} from "./types.js";
import type { InvokeConfiguration, StreamConfiguration } from "./runtime.js";
import type {
  InferContextInput,
  ToAnnotationRoot,
  AnyAnnotationRoot,
} from "./middleware/types.js";
import { type ResponseFormatUndefined } from "./responses.js";

// Helper type to get the state definition with middleware states
type MergedAgentState<
  StructuredResponseFormat extends
    | Record<string, any>
    | ResponseFormatUndefined,
  TMiddleware extends readonly AgentMiddleware[]
> = (StructuredResponseFormat extends ResponseFormatUndefined
  ? Omit<BuiltInState, "jumpTo">
  : Omit<BuiltInState, "jumpTo"> & {
      structuredResponse: StructuredResponseFormat;
    }) &
  InferMiddlewareStates<TMiddleware>;

type InvokeStateParameter<TMiddleware extends readonly AgentMiddleware[]> =
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
  TMiddleware extends readonly AgentMiddleware[] = []
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
  TMiddleware extends readonly AgentMiddleware[] = readonly AgentMiddleware[]
> {
  #graph: AgentGraph<StructuredResponseFormat, ContextSchema, TMiddleware>;

  #toolBehaviorVersion: "v1" | "v2" = "v2";

  #agentNode: AgentNode<any, AnyAnnotationRoot>;

  constructor(
    public options: CreateAgentParams<StructuredResponseFormat, ContextSchema>
  ) {
    this.#toolBehaviorVersion = options.version ?? this.#toolBehaviorVersion;

    /**
     * validate that model option is provided
     */
    if (!options.model) {
      throw new Error("`model` option is required to create an agent.");
    }

    /**
     * Check if the LLM already has bound tools and throw if it does.
     */
    if (typeof options.model !== "string") {
      validateLLMHasNoBoundTools(options.model);
    }

    /**
     * define complete list of tools based on options and middleware
     */
    const middlewareTools = (this.options.middleware
      ?.filter((m) => m.tools)
      .flatMap((m) => m.tools) ?? []) as (ClientTool | ServerTool)[];
    const toolClasses = [...(options.tools ?? []), ...middlewareTools];

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

    /**
     * Create a schema that merges agent base schema with middleware state schemas
     * Using Zod with withLangGraph ensures LangGraph Studio gets proper metadata
     */
    const schema = createAgentAnnotationConditional<TMiddleware>(
      this.options.responseFormat !== undefined,
      this.options.middleware as TMiddleware
    );

    const workflow = new StateGraph(
      schema as unknown as AnnotationRoot<any>,
      this.options.contextSchema
    );

    const allNodeWorkflows = workflow as WithStateGraphNodes<
      "tools" | "model_request" | string,
      typeof workflow
    >;

    // Generate node names for middleware nodes that have hooks
    const beforeAgentNodes: {
      index: number;
      name: string;
      allowed?: string[];
    }[] = [];
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
    const afterAgentNodes: {
      index: number;
      name: string;
      allowed?: string[];
    }[] = [];
    const wrapModelRequestHookMiddleware: [
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
      wrapModelRequestHookMiddleware,
    });

    const middlewareNames = new Set<string>();
    const middleware = this.options.middleware ?? [];
    for (let i = 0; i < middleware.length; i++) {
      let beforeAgentNode: BeforeAgentNode | undefined;
      let beforeModelNode: BeforeModelNode | undefined;
      let afterModelNode: AfterModelNode | undefined;
      let afterAgentNode: AfterAgentNode | undefined;
      const m = middleware[i];
      if (middlewareNames.has(m.name)) {
        throw new Error(`Middleware ${m.name} is defined multiple times`);
      }

      middlewareNames.add(m.name);
      if (m.beforeAgent) {
        beforeAgentNode = new BeforeAgentNode(m, {
          getPrivateState: () => this.#agentNode.getState()._privateState,
        });
        const name = `${m.name}.before_agent`;
        beforeAgentNodes.push({
          index: i,
          name,
          allowed: m.beforeAgentJumpTo,
        });
        allNodeWorkflows.addNode(
          name,
          beforeAgentNode,
          beforeAgentNode.nodeOptions
        );
      }
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
      if (m.afterAgent) {
        afterAgentNode = new AfterAgentNode(m, {
          getPrivateState: () => this.#agentNode.getState()._privateState,
        });
        const name = `${m.name}.after_agent`;
        afterAgentNodes.push({
          index: i,
          name,
          allowed: m.afterAgentJumpTo,
        });
        allNodeWorkflows.addNode(
          name,
          afterAgentNode,
          afterAgentNode.nodeOptions
        );
      }

      if (m.wrapModelRequest) {
        wrapModelRequestHookMiddleware.push([
          m,
          () => ({
            ...beforeAgentNode?.getState(),
            ...beforeModelNode?.getState(),
            ...afterModelNode?.getState(),
            ...afterAgentNode?.getState(),
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
     * Collect and compose wrapToolCall handlers from middleware
     * Wrap each handler with error handling and validation
     */
    const wrapToolCallHandler = wrapToolCall(middleware);

    /**
     * add single tool node for all tools
     */
    if (toolClasses.filter(isClientTool).length > 0) {
      const toolNode = new ToolNode(toolClasses.filter(isClientTool), {
        signal: this.options.signal,
        wrapToolCall: wrapToolCallHandler,
        getPrivateState: () => this.#agentNode.getState()._privateState,
      });
      allNodeWorkflows.addNode("tools", toolNode);
    }

    /**
     * Add Edges
     */
    // Determine the entry node (runs once at start): before_agent -> before_model -> model_request
    let entryNode: string;
    if (beforeAgentNodes.length > 0) {
      entryNode = beforeAgentNodes[0].name;
    } else if (beforeModelNodes.length > 0) {
      entryNode = beforeModelNodes[0].name;
    } else {
      entryNode = "model_request";
    }

    // Determine the loop entry node (beginning of agent loop, excludes before_agent)
    // This is where tools will loop back to for the next iteration
    const loopEntryNode =
      beforeModelNodes.length > 0 ? beforeModelNodes[0].name : "model_request";

    // Determine the exit node (runs once at end): after_agent or END
    const exitNode =
      afterAgentNodes.length > 0
        ? afterAgentNodes[afterAgentNodes.length - 1].name
        : END;

    allNodeWorkflows.addEdge(START, entryNode);

    // Connect beforeAgent nodes (run once at start)
    for (let i = 0; i < beforeAgentNodes.length; i++) {
      const node = beforeAgentNodes[i];
      const current = node.name;
      const isLast = i === beforeAgentNodes.length - 1;
      const nextDefault = isLast ? loopEntryNode : beforeAgentNodes[i + 1].name;

      if (node.allowed && node.allowed.length > 0) {
        const hasTools = toolClasses.filter(isClientTool).length > 0;
        const allowedMapped = node.allowed
          .map((t) => parseJumpToTarget(t))
          .filter((dest) => dest !== "tools" || hasTools);
        // Replace END with exitNode (which could be an afterAgent node)
        const destinations = Array.from(
          new Set([
            nextDefault,
            ...allowedMapped.map((dest) => (dest === END ? exitNode : dest)),
          ])
        ) as ("tools" | "model_request" | typeof END)[];

        allNodeWorkflows.addConditionalEdges(
          current,
          this.#createBeforeAgentRouter(
            toolClasses.filter(isClientTool),
            nextDefault,
            exitNode
          ),
          destinations
        );
      } else {
        allNodeWorkflows.addEdge(current, nextDefault);
      }
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
      // Replace END with exitNode in destinations, since exitNode might be an afterAgent node
      const destinations = modelPaths.map((p) =>
        p === END ? exitNode : p
      ) as ("tools" | "model_request" | typeof END)[];
      if (destinations.length === 1) {
        allNodeWorkflows.addEdge("model_request", destinations[0]);
      } else {
        allNodeWorkflows.addConditionalEdges(
          "model_request",
          this.#createModelRouter(exitNode),
          destinations
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

      // Include exitNode in the paths since afterModel should be able to route to after_agent or END
      const modelPaths = this.#getModelPaths(
        toolClasses.filter(isClientTool),
        true
      ).filter(
        (p) => p !== "tools" || toolClasses.filter(isClientTool).length > 0
      );

      const allowJump = Boolean(
        firstAfterModel.allowed && firstAfterModel.allowed.length > 0
      );

      // Replace END with exitNode in destinations, since exitNode might be an afterAgent node
      const destinations = modelPaths.map((p) =>
        p === END ? exitNode : p
      ) as ("tools" | "model_request" | typeof END)[];

      allNodeWorkflows.addConditionalEdges(
        firstAfterModelNode,
        this.#createAfterModelRouter(
          toolClasses.filter(isClientTool),
          allowJump,
          exitNode
        ),
        destinations
      );
    }

    // Connect afterAgent nodes (run once at end, in reverse order like afterModel)
    for (let i = afterAgentNodes.length - 1; i > 0; i--) {
      const node = afterAgentNodes[i];
      const current = node.name;
      const nextDefault = afterAgentNodes[i - 1].name;

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

    // Connect the first afterAgent node (last to execute) to END
    if (afterAgentNodes.length > 0) {
      const firstAfterAgent = afterAgentNodes[0];
      const firstAfterAgentNode = firstAfterAgent.name;

      if (firstAfterAgent.allowed && firstAfterAgent.allowed.length > 0) {
        const hasTools = toolClasses.filter(isClientTool).length > 0;
        const allowedMapped = firstAfterAgent.allowed
          .map((t) => parseJumpToTarget(t))
          .filter((dest) => dest !== "tools" || hasTools);

        /**
         * For after_agent, only use explicitly allowed destinations (don't add loopEntryNode)
         * The default destination (when no jump occurs) should be END
         */
        const destinations = Array.from(new Set([END, ...allowedMapped])) as (
          | "tools"
          | "model_request"
          | typeof END
        )[];

        allNodeWorkflows.addConditionalEdges(
          firstAfterAgentNode,
          this.#createAfterModelSequenceRouter(
            toolClasses.filter(isClientTool),
            firstAfterAgent.allowed,
            END as string
          ),
          destinations
        );
      } else {
        allNodeWorkflows.addEdge(firstAfterAgentNode, END);
      }
    }

    /**
     * add edges for tools node
     */
    if (toolClasses.filter(isClientTool).length > 0) {
      // Tools should return to loop entry node (not including before_agent)
      const toolReturnTarget = loopEntryNode;

      if (shouldReturnDirect.size > 0) {
        allNodeWorkflows.addConditionalEdges(
          "tools",
          this.#createToolsRouter(shouldReturnDirect, exitNode),
          [toolReturnTarget, exitNode as string]
        );
      } else {
        allNodeWorkflows.addEdge("tools", toolReturnTarget);
      }
    }

    /**
     * compile the graph
     */
    this.#graph = allNodeWorkflows.compile({
      checkpointer: this.options.checkpointer,
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
  #createToolsRouter(
    shouldReturnDirect: Set<string>,
    exitNode: string | typeof END
  ) {
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
        // Otherwise, return directly to exit node (could be after_agent or END)
        return this.options.responseFormat ? "model_request" : exitNode;
      }

      // For non-returnDirect tools, always route back to agent
      return "model_request";
    };
  }

  /**
   * Create routing function for model node conditional edges.
   * @param exitNode - The exit node to route to (could be after_agent or END)
   */
  #createModelRouter(exitNode: string | typeof END = END) {
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
        return exitNode;
      }

      // Check if all tool calls are for structured response extraction
      const hasOnlyStructuredResponseCalls = lastMessage.tool_calls.every(
        (toolCall) => toolCall.name.startsWith("extract-")
      );

      if (hasOnlyStructuredResponseCalls) {
        // If all tool calls are for structured response extraction, go to exit node
        // The AgentNode will handle these internally and return the structured response
        return exitNode;
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
        return exitNode;
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
   * @param allowJump - Whether jumping is allowed
   * @param exitNode - The exit node to route to (could be after_agent or END)
   * @returns Router function that handles jumpTo logic and normal routing
   */
  #createAfterModelRouter(
    toolClasses: (ClientTool | ServerTool)[],
    allowJump: boolean,
    exitNode: string | typeof END
  ) {
    const hasStructuredResponse = Boolean(this.options.responseFormat);

    return (state: Omit<BuiltInState, "jumpTo"> & { jumpTo?: JumpTo }) => {
      // First, check if we just processed a structured response
      // If so, ignore any existing jumpTo and go to exitNode
      const messages = state.messages;
      const lastMessage = messages.at(-1);
      if (
        AIMessage.isInstance(lastMessage) &&
        (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0)
      ) {
        return exitNode;
      }

      // Check if jumpTo is set in the state and allowed
      if (allowJump && state.jumpTo) {
        if (state.jumpTo === END) {
          return exitNode;
        }
        if (state.jumpTo === "tools") {
          // If trying to jump to tools but no tools are available, go to exitNode
          if (toolClasses.length === 0) {
            return exitNode;
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
        return exitNode;
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
        return exitNode;
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
   * Create routing function for jumpTo functionality after beforeAgent hooks.
   * Falls back to the default next node if no jumpTo is present.
   * When jumping to END, routes to exitNode (which could be an afterAgent node).
   */
  #createBeforeAgentRouter(
    toolClasses: (ClientTool | ServerTool)[],
    nextDefault: string,
    exitNode: string | typeof END
  ) {
    return (state: BuiltInState) => {
      if (!state.jumpTo) {
        return nextDefault;
      }
      const destination = parseJumpToTarget(state.jumpTo);
      if (destination === END) {
        // When beforeAgent jumps to END, route to exitNode (first afterAgent node)
        return exitNode;
      }
      if (destination === "tools") {
        if (toolClasses.length === 0) {
          return exitNode;
        }
        return new Send("tools", { ...state, jumpTo: undefined });
      }
      // destination === "model_request"
      return new Send("model_request", { ...state, jumpTo: undefined });
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
  streamEvents(
    state: InvokeStateParameter<TMiddleware>,
    config?: StreamConfiguration<
      InferContextInput<ContextSchema> &
        InferMiddlewareContextInputs<TMiddleware>
    > & { version?: "v1" | "v2" },
    streamOptions?: Parameters<Runnable["streamEvents"]>[2]
  ): IterableReadableStream<StreamEvent> {
    return this.#graph.streamEvents(
      state,
      {
        ...(config as any),
        version: config?.version ?? "v2",
      },
      streamOptions
    );
  }
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
  /**
   * @internal
   */
  updateState(
    inputConfig: LangGraphRunnableConfig,
    values: Record<string, unknown> | unknown,
    asNode?: string
  ) {
    return this.#graph.updateState(inputConfig, values, asNode) as never;
  }
}
