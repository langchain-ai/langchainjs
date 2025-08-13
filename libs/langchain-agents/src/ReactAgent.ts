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

import { createReactAgentAnnotation } from "./annotation.js";
import { getTools, isClientTool } from "./utils.js";
import { AgentNode } from "./nodes/AgentNode.js";
import { StructuredResponseNode } from "./nodes/StructuredResponseNode.js";
import type {
  CreateReactAgentParams,
  AnyAnnotationRoot,
  ClientTool,
  ServerTool,
  AgentState,
  ToAnnotationRoot,
  WithStateGraphNodes,
} from "./types.js";

export class ReactAgent<
  A extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot,
  StructuredResponseFormat extends Record<string, any> = Record<string, any>,
  C extends AnyAnnotationRoot | InteropZodObject = AnyAnnotationRoot
> {
  #graph: CompiledStateGraph<
    ToAnnotationRoot<A>["State"],
    ToAnnotationRoot<A>["Update"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    typeof MessagesAnnotation.spec & ToAnnotationRoot<A>["spec"],
    ReturnType<
      typeof createReactAgentAnnotation<StructuredResponseFormat>
    >["spec"] &
      ToAnnotationRoot<A>["spec"]
  >;

  #inputSchema?: AnnotationRoot<ToAnnotationRoot<A>["spec"]>;

  constructor(
    public options: CreateReactAgentParams<A, StructuredResponseFormat, C>
  ) {
    const { toolClasses, toolNode } = getTools(options.tools);
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

    const schema =
      this.options.stateSchema ??
      createReactAgentAnnotation<StructuredResponseFormat>();

    const workflow = new StateGraph(
      schema as AnyAnnotationRoot,
      this.options.contextSchema
    );

    const allNodeWorkflows = workflow as WithStateGraphNodes<
      | "pre_model_hook"
      | "post_model_hook"
      | "generate_structured_response"
      | "tools"
      | "agent",
      typeof workflow
    >;

    /**
     * Add Nodes
     */
    allNodeWorkflows.addNode(
      "agent",
      new AgentNode({
        llm: this.options.llm,
        prompt: this.options.prompt,
        includeAgentName: this.options.includeAgentName,
        toolClasses: toolClasses,
      }),
      {
        input: this.#inputSchema,
      }
    );

    if (toolClasses.length > 0) {
      allNodeWorkflows.addNode("tools", toolNode);
    }

    /**
     * setup preModelHook
     */
    if (options.preModelHook) {
      if (typeof options.preModelHook !== "function") {
        throw new Error("preModelHook must be a function");
      }

      allNodeWorkflows.addNode("pre_model_hook", options.preModelHook);
    }

    /**
     * setup postModelHook
     */
    if (options.postModelHook) {
      if (typeof options.postModelHook !== "function") {
        throw new Error("postModelHook must be a function");
      }

      allNodeWorkflows.addNode("post_model_hook", options.postModelHook);
    }

    if (this.options.responseFormat) {
      allNodeWorkflows.addNode(
        "generate_structured_response",
        new StructuredResponseNode({
          llm: this.options.llm,
          responseFormat: this.options.responseFormat,
        })
      );
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
      const postHookPaths = this.#getPostModelHookPaths(toolClasses);
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
      const modelPaths = this.#getModelPaths(toolClasses);
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

    if (toolClasses.length > 0) {
      if (shouldReturnDirect) {
        allNodeWorkflows.addConditionalEdges(
          "tools",
          this.#createToolsRouter(shouldReturnDirect),
          [this.#getEntryPoint(), END]
        );
      }
    } else {
      allNodeWorkflows.addEdge("tools", this.#getEntryPoint());
    }

    this.#graph = allNodeWorkflows.compile({
      checkpointer: this.options.checkpointer ?? this.options.checkpointSaver,
      interruptBefore: this.options.interruptBefore,
      interruptAfter: this.options.interruptAfter,
      store: this.options.store,
      name: this.options.name,
    });
  }

  #getEntryPoint() {
    const entryPoint = this.options.preModelHook ? "pre_model_hook" : "agent";
    return entryPoint;
  }

  /**
   * Get possible edge destinations from post_model_hook node.
   */
  #getPostModelHookPaths(toolClasses: (ClientTool | ServerTool)[]) {
    const paths: (
      | typeof END
      | "agent"
      | "pre_model_hook"
      | "generate_structured_response"
      | "tools"
    )[] = [];
    if (toolClasses.length > 0) {
      paths.push(this.#getEntryPoint(), "tools");
    }
    if (this.options.responseFormat) {
      paths.push("generate_structured_response");
    } else {
      paths.push(END);
    }
    return paths;
  }

  #createPostModelHookRouter() {
    return (state: AgentState<StructuredResponseFormat>) => {
      const messages = state.messages;
      const toolMessages = messages.filter(isToolMessage);
      const lastAiMessage = messages.filter(isAIMessage).at(-1);
      const pendingToolCalls = lastAiMessage?.tool_calls?.filter(
        (call) => !toolMessages.some((m) => m.tool_call_id === call.id)
      );

      if (pendingToolCalls) {
        return pendingToolCalls.map(
          (toolCall) => new Send("tools", { ...state, lg_tool_call: toolCall })
        );
      }

      if (messages.at(-1) instanceof ToolMessage) {
        return this.#getEntryPoint();
      }

      if (this.options.responseFormat) {
        return "generate_structured_response";
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
  ): ("tools" | "generate_structured_response" | typeof END)[] {
    const paths: ("tools" | "generate_structured_response" | typeof END)[] = [];
    if (toolClasses.length > 0) {
      return ["tools"];
    }

    paths.push(
      this.options.responseFormat ? "generate_structured_response" : END
    );

    return paths;
  }

  /**
   * Create routing function for model node conditional edges.
   */
  #createModelRouter() {
    /**
     * determine if the agent should continue or not
     */
    return (state: AgentState<StructuredResponseFormat>) => {
      const messages = state.messages;
      const lastMessage = messages.at(-1);

      if (!(lastMessage instanceof AIMessage) || !lastMessage.tool_calls) {
        if (this.options.postModelHook) {
          return "post_model_hook";
        }

        if (this.options.responseFormat) {
          return "generate_structured_response";
        }

        return END;
      }

      if (this.options.postModelHook) {
        return "post_model_hook";
      }

      return lastMessage.tool_calls.map(
        (toolCall) => new Send("tools", { ...state, lg_tool_call: toolCall })
      );
    };
  }

  /**
   * Create routing function for tools node conditional edges.
   */
  #createToolsRouter(shouldReturnDirect: Set<string>) {
    return (state: AgentState<StructuredResponseFormat>) => {
      const messages = state.messages;
      let lastAIMessage: AIMessage | undefined;
      for (const message of messages.reverse()) {
        lastAIMessage = message instanceof AIMessage ? message : undefined;

        if (!(message instanceof ToolMessage)) {
          break;
        }

        if (message.name && shouldReturnDirect.has(message.name)) {
          return END;
        }
      }

      if (
        lastAIMessage &&
        lastAIMessage.tool_calls &&
        lastAIMessage.tool_calls.some((call) =>
          shouldReturnDirect.has(call.name)
        )
      ) {
        return END;
      }

      return this.#getEntryPoint();
    };
  }

  invoke(
    input: ToAnnotationRoot<A>["State"]
  ): Promise<ToAnnotationRoot<A>["Update"]> {
    return this.#graph.invoke(input);
  }

  stream(
    input: ToAnnotationRoot<A>["State"]
  ): Promise<ReadableStream<ToAnnotationRoot<A>["Update"]>> {
    return this.#graph.stream(input);
  }
}
