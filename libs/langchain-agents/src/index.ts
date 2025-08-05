import {
  BaseChatModel,
  BindToolsInput,
} from "@langchain/core/language_models/chat_models";
import { LanguageModelLike } from "@langchain/core/language_models/base";
import {
  BaseMessage,
  isAIMessage,
  isBaseMessage,
  isToolMessage,
  SystemMessage,
} from "@langchain/core/messages";
import {
  Runnable,
  RunnableConfig,
  RunnableLambda,
  RunnableSequence,
  RunnableBinding,
  type RunnableLike,
} from "@langchain/core/runnables";

import type { InteropZodObject } from "@langchain/core/utils/types";

import {
  Annotation,
  AnnotationRoot,
  StateGraph,
  type CompiledStateGraph,
  MessagesAnnotation,
  Messages,
  messagesStateReducer,
  END,
  START,
} from "@langchain/langgraph";

import type {
  AnyAnnotationRoot,
  CreateReactAgentParams,
  StructuredResponseSchemaOptions,
  ClientTool,
  ServerTool,
  Prompt,
  ToAnnotationRoot,
} from "./types.js";
import { PreHookAnnotation } from "./PreHookAnnotation.js";
import { ToolNode } from "./ToolNode.js";
import { withAgentName } from "./withAgentName.js";

export interface AgentState<
  StructuredResponseType extends Record<string, unknown> = Record<
    string,
    unknown
  >
> {
  messages: BaseMessage[];
  // TODO: This won't be set until we
  // implement managed values in LangGraphJS
  // Will be useful for inserting a message on
  // graph recursion end
  // is_last_step: boolean;
  structuredResponse: StructuredResponseType;
}

const PROMPT_RUNNABLE_NAME = "prompt";

function _getPromptRunnable(
  prompt?: Prompt
): Runnable<unknown, unknown, RunnableConfig<Record<string, unknown>>> {
  let promptRunnable: Runnable<
    unknown,
    unknown,
    RunnableConfig<Record<string, unknown>>
  >;

  if (prompt == null) {
    promptRunnable = RunnableLambda.from(
      (state: typeof MessagesAnnotation.State) => state.messages
    ).withConfig({ runName: PROMPT_RUNNABLE_NAME });
  } else if (typeof prompt === "string") {
    const systemMessage = new SystemMessage(prompt);
    promptRunnable = RunnableLambda.from(
      (state: typeof MessagesAnnotation.State) => {
        return [systemMessage, ...(state.messages ?? [])];
      }
    ).withConfig({ runName: PROMPT_RUNNABLE_NAME });
  } else if (isBaseMessage(prompt) && prompt._getType() === "system") {
    promptRunnable = RunnableLambda.from(
      (state: typeof MessagesAnnotation.State) => [prompt, ...state.messages]
    ).withConfig({ runName: PROMPT_RUNNABLE_NAME });
  } else if (typeof prompt === "function") {
    promptRunnable = RunnableLambda.from(prompt).withConfig({
      runName: PROMPT_RUNNABLE_NAME,
    });
  } else if (Runnable.isRunnable(prompt)) {
    promptRunnable = prompt;
  } else {
    throw new Error(`Got unexpected type for 'prompt': ${typeof prompt}`);
  }

  return promptRunnable;
}

function isClientTool(tool: ClientTool | ServerTool): tool is ClientTool {
  return Runnable.isRunnable(tool);
}

function _isBaseChatModel(model: LanguageModelLike): model is BaseChatModel {
  return (
    "invoke" in model &&
    typeof model.invoke === "function" &&
    "_modelType" in model
  );
}

interface ConfigurableModelInterface {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _queuedMethodOperations: Record<string, any>;
  _model: () => Promise<BaseChatModel>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _isConfigurableModel(model: any): model is ConfigurableModelInterface {
  return (
    "_queuedMethodOperations" in model &&
    "_model" in model &&
    typeof model._model === "function"
  );
}

function _isChatModelWithBindTools(
  llm: LanguageModelLike
): llm is BaseChatModel & Required<Pick<BaseChatModel, "bindTools">> {
  if (!_isBaseChatModel(llm)) return false;
  return "bindTools" in llm && typeof llm.bindTools === "function";
}

export async function _shouldBindTools(
  llm: LanguageModelLike,
  tools: (ClientTool | ServerTool)[]
): Promise<boolean> {
  // If model is a RunnableSequence, find a RunnableBinding or BaseChatModel in its steps
  let model = llm;
  if (RunnableSequence.isRunnableSequence(model)) {
    model =
      model.steps.find(
        (step) =>
          RunnableBinding.isRunnableBinding(step) ||
          _isBaseChatModel(step) ||
          _isConfigurableModel(step)
      ) || model;
  }

  if (_isConfigurableModel(model)) {
    model = await model._model();
  }

  // If not a RunnableBinding, we should bind tools
  if (!RunnableBinding.isRunnableBinding(model)) {
    return true;
  }

  let boundTools = (() => {
    // check if model.kwargs contain the tools key
    if (
      model.kwargs != null &&
      typeof model.kwargs === "object" &&
      "tools" in model.kwargs &&
      Array.isArray(model.kwargs.tools)
    ) {
      return (model.kwargs.tools ?? null) as BindToolsInput[] | null;
    }

    // Some models can bind the tools via `withConfig()` instead of `bind()`
    if (
      model.config != null &&
      typeof model.config === "object" &&
      "tools" in model.config &&
      Array.isArray(model.config.tools)
    ) {
      return (model.config.tools ?? null) as BindToolsInput[] | null;
    }

    return null;
  })();

  // google-style
  if (
    boundTools != null &&
    boundTools.length === 1 &&
    "functionDeclarations" in boundTools[0]
  ) {
    boundTools = boundTools[0].functionDeclarations;
  }

  // If no tools in kwargs, we should bind tools
  if (boundTools == null) return true;

  // Check if tools count matches
  if (tools.length !== boundTools.length) {
    throw new Error(
      "Number of tools in the model.bindTools() and tools passed to createReactAgent must match"
    );
  }

  const toolNames = new Set<string>(
    tools.flatMap((tool) => (isClientTool(tool) ? tool.name : []))
  );

  const boundToolNames = new Set<string>();

  for (const boundTool of boundTools) {
    let boundToolName: string | undefined;

    // OpenAI-style tool
    if ("type" in boundTool && boundTool.type === "function") {
      boundToolName = boundTool.function.name;
    }
    // Anthropic or Google-style tool
    else if ("name" in boundTool) {
      boundToolName = boundTool.name;
    }
    // Bedrock-style tool
    else if ("toolSpec" in boundTool && "name" in boundTool.toolSpec) {
      boundToolName = boundTool.toolSpec.name;
    }
    // unknown tool type so we'll ignore it
    else {
      continue;
    }

    if (boundToolName) {
      boundToolNames.add(boundToolName);
    }
  }

  const missingTools = [...toolNames].filter((x) => !boundToolNames.has(x));
  if (missingTools.length > 0) {
    throw new Error(
      `Missing tools '${missingTools}' in the model.bindTools().` +
        `Tools in the model.bindTools() must match the tools passed to createReactAgent.`
    );
  }

  return false;
}

const _simpleBindTools = (
  llm: LanguageModelLike,
  toolClasses: (ClientTool | ServerTool)[]
) => {
  if (_isChatModelWithBindTools(llm)) {
    return llm.bindTools(toolClasses);
  }

  if (
    RunnableBinding.isRunnableBinding(llm) &&
    _isChatModelWithBindTools(llm.bound)
  ) {
    const newBound = llm.bound.bindTools(toolClasses);

    if (RunnableBinding.isRunnableBinding(newBound)) {
      return new RunnableBinding({
        bound: newBound.bound,
        config: { ...llm.config, ...newBound.config },
        kwargs: { ...llm.kwargs, ...newBound.kwargs },
        configFactories: newBound.configFactories ?? llm.configFactories,
      });
    }

    return new RunnableBinding({
      bound: newBound,
      config: llm.config,
      kwargs: llm.kwargs,
      configFactories: llm.configFactories,
    });
  }

  return null;
};

export async function _bindTools(
  llm: LanguageModelLike,
  toolClasses: (ClientTool | ServerTool)[]
): Promise<RunnableLike> {
  const model = _simpleBindTools(llm, toolClasses);
  if (model) return model;

  if (_isConfigurableModel(llm)) {
    const model = _simpleBindTools(await llm._model(), toolClasses);
    if (model) return model;
  }

  if (RunnableSequence.isRunnableSequence(llm)) {
    const modelStep = llm.steps.findIndex(
      (step) =>
        RunnableBinding.isRunnableBinding(step) ||
        _isBaseChatModel(step) ||
        _isConfigurableModel(step)
    );

    if (modelStep >= 0) {
      const model = _simpleBindTools(llm.steps[modelStep], toolClasses);
      if (model) {
        const nextSteps: unknown[] = llm.steps.slice();
        nextSteps.splice(modelStep, 1, model);

        return RunnableSequence.from(
          nextSteps as [RunnableLike, ...RunnableLike[], RunnableLike]
        );
      }
    }
  }

  throw new Error(`llm ${llm} must define bindTools method.`);
}

export async function _getModel(
  llm: LanguageModelLike | ConfigurableModelInterface
): Promise<BaseChatModel> {
  // If model is a RunnableSequence, find a RunnableBinding or BaseChatModel in its steps
  let model = llm;
  if (RunnableSequence.isRunnableSequence(model)) {
    model =
      model.steps.find(
        (step) =>
          RunnableBinding.isRunnableBinding(step) ||
          _isBaseChatModel(step) ||
          _isConfigurableModel(step)
      ) || model;
  }

  if (_isConfigurableModel(model)) {
    model = await model._model();
  }

  // Get the underlying model from a RunnableBinding
  if (RunnableBinding.isRunnableBinding(model)) {
    model = model.bound as BaseChatModel;
  }

  if (!_isBaseChatModel(model)) {
    throw new Error(
      `Expected \`llm\` to be a ChatModel or RunnableBinding (e.g. llm.bind_tools(...)) with invoke() and generate() methods, got ${model.constructor.name}`
    );
  }

  return model as BaseChatModel;
}

export const createReactAgentAnnotation = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>
>() =>
  Annotation.Root({
    messages: Annotation<BaseMessage[], Messages>({
      reducer: messagesStateReducer,
      default: () => [],
    }),
    structuredResponse: Annotation<T>,
  });

type WithStateGraphNodes<K extends string, Graph> = Graph extends StateGraph<
  infer SD,
  infer S,
  infer U,
  infer N,
  infer I,
  infer O,
  infer C
>
  ? StateGraph<SD, S, U, N | K, I, O, C>
  : never;

/**
 * Creates a StateGraph agent that relies on a chat model utilizing tool calling.
 *
 * @example
 * ```ts
 * import { ChatOpenAI } from "@langchain/openai";
 * import { tool } from "@langchain/core/tools";
 * import { z } from "zod";
 * import { createReactAgent } from "@langchain/langgraph/prebuilt";
 *
 * const model = new ChatOpenAI({
 *   model: "gpt-4o",
 * });
 *
 * const getWeather = tool((input) => {
 *   if (["sf", "san francisco"].includes(input.location.toLowerCase())) {
 *     return "It's 60 degrees and foggy.";
 *   } else {
 *     return "It's 90 degrees and sunny.";
 *   }
 * }, {
 *   name: "get_weather",
 *   description: "Call to get the current weather.",
 *   schema: z.object({
 *     location: z.string().describe("Location to get the weather for."),
 *   })
 * })
 *
 * const agent = createReactAgent({ llm: model, tools: [getWeather] });
 *
 * const inputs = {
 *   messages: [{ role: "user", content: "what is the weather in SF?" }],
 * };
 *
 * const stream = await agent.stream(inputs, { streamMode: "values" });
 *
 * for await (const { messages } of stream) {
 *   console.log(messages);
 * }
 * // Returns the messages in the state at each step of execution
 * ```
 */
export function createReactAgent<
  A extends AnyAnnotationRoot | InteropZodObject = typeof MessagesAnnotation,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  StructuredResponseFormat extends Record<string, any> = Record<string, any>
>(
  params: CreateReactAgentParams<A, StructuredResponseFormat>
): CompiledStateGraph<
  ToAnnotationRoot<A>["State"],
  ToAnnotationRoot<A>["Update"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  typeof MessagesAnnotation.spec & ToAnnotationRoot<A>["spec"],
  ReturnType<
    typeof createReactAgentAnnotation<StructuredResponseFormat>
  >["spec"] &
    ToAnnotationRoot<A>["spec"]
> {
  const {
    llm,
    tools,
    prompt,
    stateSchema,
    checkpointSaver,
    checkpointer,
    interruptBefore,
    interruptAfter,
    store,
    responseFormat,
    preModelHook,
    postModelHook,
    name,
    includeAgentName,
  } = params;

  let toolClasses: (ClientTool | ServerTool)[];

  let toolNode: ToolNode;
  if (!Array.isArray(tools)) {
    toolClasses = tools.tools;
    toolNode = tools;
  } else {
    toolClasses = tools;
    toolNode = new ToolNode(toolClasses.filter(isClientTool));
  }

  let cachedModelRunnable: Runnable | null = null;

  const getModelRunnable = async (llm: LanguageModelLike) => {
    if (cachedModelRunnable) {
      return cachedModelRunnable;
    }

    let modelWithTools: LanguageModelLike;
    if (await _shouldBindTools(llm, toolClasses)) {
      modelWithTools = (await _bindTools(
        llm,
        toolClasses
      )) as LanguageModelLike;
    } else {
      modelWithTools = llm;
    }

    const promptRunnable = _getPromptRunnable(prompt);

    const modelRunnable =
      includeAgentName === "inline"
        ? promptRunnable.pipe(withAgentName(modelWithTools, includeAgentName))
        : promptRunnable.pipe(modelWithTools);

    cachedModelRunnable = modelRunnable;
    return modelRunnable;
  };

  // If any of the tools are configured to return_directly after running,
  // our graph needs to check if these were called
  const shouldReturnDirect = new Set(
    toolClasses
      .filter(isClientTool)
      .filter((tool) => "returnDirect" in tool && tool.returnDirect)
      .map((tool) => tool.name)
  );

  function getModelInputState(
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"]
  ): Omit<AgentState<StructuredResponseFormat>, "llmInputMessages"> {
    const { messages, llmInputMessages, ...rest } = state;
    if (llmInputMessages != null && llmInputMessages.length > 0) {
      return { messages: llmInputMessages, ...rest };
    }
    return { messages, ...rest };
  }

  const generateStructuredResponse = async (
    state: AgentState<StructuredResponseFormat>,
    config?: RunnableConfig
  ) => {
    if (responseFormat == null) {
      throw new Error(
        "Attempted to generate structured output with no passed response schema. Please contact us for help."
      );
    }
    const messages = [...state.messages];
    let modelWithStructuredOutput;

    const model = await _getModel(llm);

    if (typeof responseFormat === "object" && "schema" in responseFormat) {
      const { prompt, schema, ...options } =
        responseFormat as StructuredResponseSchemaOptions<StructuredResponseFormat>;

      modelWithStructuredOutput = model.withStructuredOutput(schema, options);
      if (prompt != null) {
        messages.unshift(new SystemMessage({ content: prompt }));
      }
    } else {
      modelWithStructuredOutput = model.withStructuredOutput(responseFormat);
    }

    const response = await modelWithStructuredOutput.invoke(messages, config);
    return { structuredResponse: response };
  };

  const callModel = async (
    state: AgentState<StructuredResponseFormat> & PreHookAnnotation["State"],
    config?: RunnableConfig
  ) => {
    // NOTE: we're dynamically creating the model runnable here
    // to ensure that we can validate ConfigurableModel properly
    const modelRunnable = await getModelRunnable(llm);
    // TODO: Auto-promote streaming.
    const response = (await modelRunnable.invoke(
      getModelInputState(state),
      config
    )) as BaseMessage;
    // add agent name to the AIMessage
    // TODO: figure out if we can avoid mutating the message directly
    response.name = name;
    response.lc_kwargs.name = name;
    return { messages: [response] };
  };

  const schema =
    stateSchema ?? createReactAgentAnnotation<StructuredResponseFormat>();

  const workflow = new StateGraph(schema as AnyAnnotationRoot).addNode(
    "tools",
    toolNode
  );

  if (!("messages" in workflow._schemaDefinition)) {
    throw new Error("Missing required `messages` key in state schema.");
  }

  const allNodeWorkflows = workflow as WithStateGraphNodes<
    | "pre_model_hook"
    | "post_model_hook"
    | "generate_structured_response"
    | "agent",
    typeof workflow
  >;

  const conditionalMap = <T extends string>(map: Record<string, T | null>) => {
    return Object.fromEntries(
      Object.entries(map).filter(([_, v]) => v != null) as [string, T][]
    );
  };

  let entrypoint: "agent" | "pre_model_hook" = "agent";
  let inputSchema: AnnotationRoot<ToAnnotationRoot<A>["spec"]> | undefined;
  if (preModelHook != null) {
    allNodeWorkflows
      .addNode("pre_model_hook", preModelHook)
      .addEdge("pre_model_hook", "agent");
    entrypoint = "pre_model_hook";

    inputSchema = Annotation.Root({
      ...workflow._schemaDefinition,
      ...PreHookAnnotation.spec,
    });
  } else {
    entrypoint = "agent";
  }

  allNodeWorkflows
    .addNode("agent", callModel, { input: inputSchema })
    .addEdge(START, entrypoint);

  if (postModelHook != null) {
    allNodeWorkflows
      .addNode("post_model_hook", postModelHook)
      .addEdge("agent", "post_model_hook")
      .addConditionalEdges(
        "post_model_hook",
        (state: AgentState<StructuredResponseFormat>) => {
          const { messages } = state;
          const lastMessage = messages[messages.length - 1];

          if (isAIMessage(lastMessage) && lastMessage.tool_calls?.length) {
            return "tools";
          }

          if (isToolMessage(lastMessage)) return entrypoint;
          if (responseFormat != null) return "generate_structured_response";
          return END;
        },
        conditionalMap({
          tools: "tools",
          [entrypoint]: entrypoint,
          generate_structured_response:
            responseFormat != null ? "generate_structured_response" : null,
          [END]: responseFormat != null ? null : END,
        })
      );
  }

  if (responseFormat !== undefined) {
    workflow
      .addNode("generate_structured_response", generateStructuredResponse)
      .addEdge("generate_structured_response", END);
  }

  if (postModelHook == null) {
    allNodeWorkflows.addConditionalEdges(
      "agent",
      (state: AgentState<StructuredResponseFormat>) => {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1];

        // if there's no function call, we finish
        if (!isAIMessage(lastMessage) || !lastMessage.tool_calls?.length) {
          if (responseFormat != null) return "generate_structured_response";
          return END;
        }

        // there are function calls, we continue
        return "tools";
      },
      conditionalMap({
        tools: "tools",
        generate_structured_response:
          responseFormat != null ? "generate_structured_response" : null,
        [END]: responseFormat != null ? null : END,
      })
    );
  }

  if (shouldReturnDirect.size > 0) {
    allNodeWorkflows.addConditionalEdges(
      "tools",
      (state: AgentState<StructuredResponseFormat>) => {
        // Check the last consecutive tool calls
        for (let i = state.messages.length - 1; i >= 0; i -= 1) {
          const message = state.messages[i];
          if (!isToolMessage(message)) break;

          // Check if this tool is configured to return directly
          if (
            message.name !== undefined &&
            shouldReturnDirect.has(message.name)
          ) {
            return END;
          }
        }

        return entrypoint;
      },
      conditionalMap({ [entrypoint]: entrypoint, [END]: END })
    );
  } else {
    allNodeWorkflows.addEdge("tools", entrypoint);
  }

  return allNodeWorkflows.compile({
    checkpointer: checkpointer ?? checkpointSaver,
    interruptBefore,
    interruptAfter,
    store,
    name,
  });
}

export * from "./types.js";
