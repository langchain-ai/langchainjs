/* eslint-disable prefer-destructuring */
import { InteropZodObject } from "@langchain/core/utils/types";
import {
  AnnotationRoot,
  StateGraph,
  END,
  START,
  Send,
  CompiledStateGraph,
  MessagesAnnotation,
} from "@langchain/langgraph";
import {
  isToolMessage,
  isAIMessage,
  ToolMessage,
  AIMessage,
} from "@langchain/core/messages";

import {
  createAgentAnnotationConditional,
  ReactAgentAnnotation,
} from "./annotation.js";
import { isClientTool, validateLLMHasNoBoundTools } from "./utils.js";
import { AgentNode } from "./nodes/AgentNode.js";
import { ToolNode } from "./nodes/ToolNode.js";
import type {
  CreateAgentParams,
  ClientTool,
  ServerTool,
  InternalAgentState,
  WithStateGraphNodes,
} from "./types.js";
import {
  enhanceStateSchemaWithMessageReducer,
  type AnyAnnotationRoot,
  type ToAnnotationRoot,
} from "./annotation.js";
import type { ResponseFormatUndefined } from "./responses.js";

type AgentGraph<
  StateSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot,
  StructuredResponseFormat extends
    | Record<string, any>
    | ResponseFormatUndefined = Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> = CompiledStateGraph<
  ToAnnotationRoot<StateSchema>["State"],
  ToAnnotationRoot<StateSchema>["Update"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  typeof MessagesAnnotation.spec & ToAnnotationRoot<StateSchema>["spec"],
  ReactAgentAnnotation<StructuredResponseFormat>["spec"] &
    ToAnnotationRoot<StateSchema>["spec"],
  ToAnnotationRoot<ContextSchema>["spec"],
  unknown
>;

export class ReactAgent<
  StateSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot,
  StructuredResponseFormat extends
    | Record<string, any>
    | ResponseFormatUndefined = Record<string, any>,
  ContextSchema extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> {
  #graph: AgentGraph<StateSchema, StructuredResponseFormat, ContextSchema>;

  #inputSchema?: AnnotationRoot<ToAnnotationRoot<StateSchema>["spec"]>;

  #toolBehaviorVersion: "v1" | "v2" = "v2";

  constructor(
    public options: CreateAgentParams<
      StateSchema,
      StructuredResponseFormat,
      ContextSchema
    >
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

    const toolClasses = Array.isArray(options.tools)
      ? options.tools
      : options.tools.tools;

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

    const schema = this.options.stateSchema
      ? enhanceStateSchemaWithMessageReducer(this.options.stateSchema)
      : createAgentAnnotationConditional<StructuredResponseFormat>(
          this.options.responseFormat !== undefined
        );

    const workflow = new StateGraph(schema, this.options.contextSchema);

    const allNodeWorkflows = workflow as WithStateGraphNodes<
      "pre_model_hook" | "post_model_hook" | "tools" | "agent",
      typeof workflow
    >;

    /**
     * Add Nodes
     */
    allNodeWorkflows.addNode(
      "agent",
      new AgentNode({
        llm: this.options.llm,
        model: this.options.model,
        prompt: this.options.prompt,
        includeAgentName: this.options.includeAgentName,
        name: this.options.name,
        responseFormat: this.options.responseFormat,
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
     * setup preModelHook
     */
    if (options.preModelHook) {
      allNodeWorkflows.addNode("pre_model_hook", options.preModelHook);
    }

    /**
     * setup postModelHook
     */
    if (options.postModelHook) {
      allNodeWorkflows.addNode("post_model_hook", options.postModelHook);
    }

    /**
     * Add Edges
     */
    allNodeWorkflows.addEdge(START, this.#getEntryPoint());

    if (this.options.preModelHook) {
      allNodeWorkflows.addEdge("pre_model_hook", "agent");
    }

    if (this.options.postModelHook) {
      allNodeWorkflows.addEdge("agent", "post_model_hook");
      const postHookPaths = this.#getPostModelHookPaths(
        toolClasses.filter(isClientTool)
      );
      if (postHookPaths.length === 1) {
        allNodeWorkflows.addEdge("post_model_hook", postHookPaths[0]);
      } else {
        allNodeWorkflows.addConditionalEdges(
          "post_model_hook",
          this.#createPostModelHookRouter(),
          postHookPaths
        );
      }
    } else {
      const modelPaths = this.#getModelPaths(toolClasses.filter(isClientTool));
      if (modelPaths.length === 1) {
        allNodeWorkflows.addEdge("agent", modelPaths[0]);
      } else {
        allNodeWorkflows.addConditionalEdges(
          "agent",
          this.#createModelRouter(),
          modelPaths
        );
      }
    }

    /**
     * add edges for tools node
     */
    if (toolClasses.length > 0) {
      if (shouldReturnDirect.size > 0) {
        allNodeWorkflows.addConditionalEdges(
          "tools",
          this.#createToolsRouter(shouldReturnDirect),
          [this.#getEntryPoint(), END]
        );
      } else {
        allNodeWorkflows.addEdge("tools", this.#getEntryPoint());
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
    });
  }

  /**
   * Get the compiled graph.
   */
  get graph(): AgentGraph<
    StateSchema,
    StructuredResponseFormat,
    ContextSchema
  > {
    return this.#graph;
  }

  #getEntryPoint() {
    const entryPoint = this.options.preModelHook ? "pre_model_hook" : "agent";
    return entryPoint;
  }

  /**
   * Get possible edge destinations from post_model_hook node.
   */
  #getPostModelHookPaths(toolClasses: (ClientTool | ServerTool)[]) {
    const paths: (typeof END | "agent" | "pre_model_hook" | "tools")[] = [];
    if (toolClasses.length > 0) {
      paths.push(this.#getEntryPoint(), "tools");
    }
    paths.push(END);
    return paths;
  }

  #createPostModelHookRouter() {
    return (state: InternalAgentState<StructuredResponseFormat>) => {
      const messages = state.messages;
      const toolMessages = messages.filter(isToolMessage);
      const lastAiMessage = messages.filter(isAIMessage).at(-1);
      const pendingToolCalls = lastAiMessage?.tool_calls?.filter(
        (call) => !toolMessages.some((m) => m.tool_call_id === call.id)
      );

      if (pendingToolCalls && pendingToolCalls.length > 0) {
        /**
         * The tool node processes a single message.
         * All tool calls in the message are executed in parallel within the tool node.
         * @deprecated likely to be removed in the next version of the agent
         */
        if (this.#toolBehaviorVersion === "v1") {
          return "tools";
        }

        /**
         * The tool node processes a single tool call. Tool calls are distributed across
         * multiple instances of the tool node using the Send API.
         */
        return pendingToolCalls.map(
          (toolCall) => new Send("tools", { ...state, lg_tool_call: toolCall })
        );
      }

      if (ToolMessage.isInstance(messages.at(-1))) {
        return this.#getEntryPoint();
      }

      return END;
    };
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
    return (state: InternalAgentState<StructuredResponseFormat>) => {
      const messages = state.messages;
      const lastMessage = messages.at(-1);

      if (
        !AIMessage.isInstance(lastMessage) ||
        !lastMessage.tool_calls ||
        lastMessage.tool_calls.length === 0
      ) {
        if (this.options.postModelHook) {
          return "post_model_hook";
        }

        return END;
      }

      if (this.options.postModelHook) {
        return "post_model_hook";
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
    return (state: InternalAgentState<StructuredResponseFormat>) => {
      const;
      const lastMessage = messages[messages.length - 1];

      // Check if we just executed a returnDirect tool
      if (
        ToolMessage.isInstance(lastMessage) &&
        lastMessage.name &&
        shouldReturnDirect.has(lastMessage.name)
      ) {
        // If we have a response format, route to agent to generate structured response
        // Otherwise, return directly
        return this.options.responseFormat ? this.#getEntryPoint() : END;
      }

      // For non-returnDirect tools, always route back to agent
      return this.#getEntryPoint();
    };
  }

  /**
   * @inheritdoc
   */
  get invoke(): AgentGraph<StateSchema, StructuredResponseFormat>["invoke"] {
    return this.#graph.invoke.bind(this.#graph);
  }

  /**
   * @inheritdoc
   */
  get stream(): AgentGraph<StateSchema, StructuredResponseFormat>["stream"] {
    return this.#graph.stream.bind(this.#graph);
  }

  /**
   * @inheritdoc
   */
  get streamEvents(): AgentGraph<
    StateSchema,
    StructuredResponseFormat
  >["streamEvents"] {
    return this.#graph.streamEvents.bind(this.#graph);
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
