/* eslint-disable prefer-destructuring, no-instanceof/no-instanceof */
import { InteropZodObject } from "@langchain/core/utils/types";
import {
  AnnotationRoot,
  StateGraph,
  END,
  START,
  Send,
  Command,
  CompiledStateGraph,
  type LangGraphRunnableConfig,
} from "@langchain/langgraph";
import { ToolMessage, AIMessage } from "@langchain/core/messages";

import { createAgentAnnotationConditional } from "./annotation.js";
import { isClientTool, validateLLMHasNoBoundTools } from "../utils.js";

import { AgentNode } from "./nodes/AgentNode.js";
import { ToolNode } from "../nodes/ToolNode.js";
import { BeforeModelNode } from "./nodes/BeforeModalNode.js";
import { AfterModelNode } from "./nodes/AfterModalNode.js";
import { PrepareModelRequestNode } from "./nodes/PrepareModelRequestNode.js";
import { initializeMiddlewareStates } from "./nodes/utils.js";

import type { ClientTool, ServerTool, WithStateGraphNodes } from "../types.js";

import {
  CreateAgentParams,
  AgentMiddleware,
  InferMiddlewareStates,
  InferMiddlewareInputStates,
  BuiltInState,
  InferMiddlewareContextInputs,
  IsAllOptional,
  InferContextInput,
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
  TMiddlewares extends readonly AgentMiddleware<any, any, any>[]
> = (StructuredResponseFormat extends ResponseFormatUndefined
  ? BuiltInState
  : BuiltInState & { structuredResponse: StructuredResponseFormat }) &
  InferMiddlewareStates<TMiddlewares>;

type InvokeStateParameter<
  TMiddlewares extends readonly AgentMiddleware<any, any, any>[]
> =
  | (BuiltInState & InferMiddlewareInputStates<TMiddlewares>)
  | Command<any, any, any>
  | null;

type AgentGraph<
  StructuredResponseFormat extends
    | Record<string, any>
    | ResponseFormatUndefined = Record<string, any>,
  ContextSchema extends
    | AnyAnnotationRoot
    | InteropZodObject = AnyAnnotationRoot,
  TMiddlewares extends readonly AgentMiddleware<any, any, any>[] = []
> = CompiledStateGraph<
  any,
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  any,
  MergedAgentState<StructuredResponseFormat, TMiddlewares>,
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
  TMiddlewares extends readonly AgentMiddleware<any, any, any>[] = []
> {
  #graph: AgentGraph<StructuredResponseFormat, ContextSchema, TMiddlewares>;

  #inputSchema?: AnnotationRoot<any>;

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
      TMiddlewares
    >(
      this.options.responseFormat !== undefined,
      this.options.middlewares as TMiddlewares
    );

    const workflow = new StateGraph(
      schema as AnnotationRoot<any>,
      this.options.contextSchema
    );

    // Generate node names for middleware nodes that have hooks
    const beforeModelNodes: { index: number; name: string }[] = [];
    const afterModelNodes: { index: number; name: string }[] = [];

    if (this.options.middlewares) {
      for (let i = 0; i < this.options.middlewares.length; i++) {
        const middleware = this.options.middlewares[i];
        if (middleware.beforeModel) {
          beforeModelNodes.push({
            index: i,
            name: `before_model_${middleware.name}_${i}`,
          });
        }
        if (middleware.afterModel) {
          afterModelNodes.push({
            index: i,
            name: `after_model_${middleware.name}_${i}`,
          });
        }
      }
    }

    const allNodeWorkflows = workflow as WithStateGraphNodes<
      "tools" | "model_request" | "prepare_model_request" | string,
      typeof workflow
    >;

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
        middlewares: this.options.middlewares,
        toolClasses,
        shouldReturnDirect,
        signal: this.options.signal,
      }),
      {
        input: this.#inputSchema,
      }
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
     * Add prepare model request node
     */
    if (this.options.middlewares && this.options.middlewares.length > 0) {
      const prepareModelRequestNode = new PrepareModelRequestNode({
        middlewares: this.options.middlewares,
        llm: this.options.llm,
        model: this.options.model,
      });
      allNodeWorkflows.addNode(
        "prepare_model_request",
        prepareModelRequestNode,
        {
          // private state here
          input: this.#inputSchema,
        }
      );
    }

    /**
     * Add middleware nodes
     */
    if (this.options.middlewares && this.options.middlewares.length > 0) {
      // Add beforeModel nodes for middlewares that have the hook
      for (const nodeInfo of beforeModelNodes) {
        const middleware = this.options.middlewares[nodeInfo.index];
        allNodeWorkflows.addNode(
          nodeInfo.name,
          new BeforeModelNode(middleware),
          {
            // private state here
            input: this.#inputSchema,
          }
        );
      }

      // Add afterModel nodes for middlewares that have the hook
      for (const nodeInfo of afterModelNodes) {
        const middleware = this.options.middlewares[nodeInfo.index];
        allNodeWorkflows.addNode(
          nodeInfo.name,
          new AfterModelNode(middleware),
          {
            // private state here
            input: this.#inputSchema,
          }
        );
      }
    }

    /**
     * Add Edges
     */
    // Determine starting point based on what nodes exist
    if (beforeModelNodes.length > 0) {
      // If we have beforeModel nodes, start with the first one
      allNodeWorkflows.addEdge(START, beforeModelNodes[0].name);
    } else if (
      this.options.middlewares &&
      this.options.middlewares.length > 0
    ) {
      // If no beforeModel nodes but we have middlewares, start with prepare_model_request
      allNodeWorkflows.addEdge(START, "prepare_model_request");
    } else {
      // If no middlewares at all, go directly to agent
      allNodeWorkflows.addEdge(START, "model_request");
    }

    // Connect beforeModel nodes in sequence
    for (let i = 0; i < beforeModelNodes.length - 1; i++) {
      allNodeWorkflows.addEdge(
        beforeModelNodes[i].name,
        beforeModelNodes[i + 1].name
      );
    }

    // Connect last beforeModel node to prepare_model_request node (if middlewares exist) or agent
    const lastBeforeModelNode = beforeModelNodes.at(-1);
    if (beforeModelNodes.length > 0 && lastBeforeModelNode) {
      if (this.options.middlewares && this.options.middlewares.length > 0) {
        allNodeWorkflows.addEdge(
          lastBeforeModelNode.name,
          "prepare_model_request"
        );
      } else {
        allNodeWorkflows.addEdge(lastBeforeModelNode.name, "model_request");
      }
    }

    // Connect prepare_model_request node to agent (if it exists)
    if (this.options.middlewares && this.options.middlewares.length > 0) {
      allNodeWorkflows.addEdge("prepare_model_request", "model_request");
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
      // Tools should return to first beforeModel node or prepare_model_request/agent
      let toolReturnTarget: string;
      if (beforeModelNodes.length > 0) {
        toolReturnTarget = beforeModelNodes[0].name;
      } else if (
        this.options.middlewares &&
        this.options.middlewares.length > 0
      ) {
        toolReturnTarget = "prepare_model_request";
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
    }) as AgentGraph<StructuredResponseFormat, ContextSchema, TMiddlewares>;
  }

  /**
   * Get the compiled graph.
   */
  get graph(): AgentGraph<
    StructuredResponseFormat,
    ContextSchema,
    TMiddlewares
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
        !(lastMessage instanceof AIMessage) ||
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
        lastMessage instanceof ToolMessage &&
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
    state: InvokeStateParameter<TMiddlewares>
  ): InvokeStateParameter<TMiddlewares> {
    if (
      !this.options.middlewares ||
      this.options.middlewares.length === 0 ||
      state instanceof Command ||
      !state
    ) {
      return state;
    }

    const defaultStates = initializeMiddlewareStates(
      this.options.middlewares,
      state
    );
    const updatedState = { ...state } as InvokeStateParameter<TMiddlewares>;
    if (!updatedState) {
      return updatedState;
    }

    // Only add defaults for keys that don't exist in current state
    for (const [key, value] of Object.entries(defaultStates)) {
      if (!(key in updatedState)) {
        // @ts-expect-error
        updatedState[key as keyof InvokeStateParameter<TMiddlewares>] = value;
      }
    }

    return updatedState;
  }

  /**
   * @inheritdoc
   */
  get invoke() {
    type FullState = MergedAgentState<StructuredResponseFormat, TMiddlewares>;
    type FullContext = InferContextInput<ContextSchema> &
      InferMiddlewareContextInputs<TMiddlewares>;

    // Create overloaded function type based on whether context has required fields
    type InvokeFunction = IsAllOptional<FullContext> extends true
      ? (
          state: InvokeStateParameter<TMiddlewares>,
          config?: LangGraphRunnableConfig<FullContext>
        ) => Promise<FullState>
      : (
          state: InvokeStateParameter<TMiddlewares>,
          config?: LangGraphRunnableConfig<FullContext>
        ) => Promise<FullState>;

    const invokeFunc: InvokeFunction = async (
      state: InvokeStateParameter<TMiddlewares>,
      config?: LangGraphRunnableConfig<FullContext>
    ): Promise<FullState> => {
      const initializedState = this.#initializeMiddlewareStates(state);
      return this.#graph.invoke(
        initializedState,
        config as any
      ) as Promise<FullState>;
    };

    return invokeFunc;
  }

  /**
   * ToDo(@christian-bromann): Add stream and streamEvents methods
   */

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
