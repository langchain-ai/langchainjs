import * as uuid from "uuid";
import type { ChainValues } from "../utils/types.js";
import type { BaseMessage } from "../messages/index.js";
import type { AgentAction, AgentFinish } from "../agents.js";
import type {
  ChatGenerationChunk,
  GenerationChunk,
  LLMResult,
} from "../outputs.js";
import {
  Serializable,
  Serialized,
  SerializedNotImplemented,
  get_lc_unique_name,
} from "../load/serializable.js";
import type { SerializedFields } from "../load/map_keys.js";
import { Document } from "../documents/document.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Error = any;

/**
 * Interface for the input parameters of the BaseCallbackHandler class. It
 * allows to specify which types of events should be ignored by the
 * callback handler.
 */
export interface BaseCallbackHandlerInput {
  ignoreLLM?: boolean;
  ignoreChain?: boolean;
  ignoreAgent?: boolean;
  ignoreRetriever?: boolean;
}

/**
 * Interface for the indices of a new token produced by an LLM or Chat
 * Model in streaming mode.
 */
export interface NewTokenIndices {
  prompt: number;
  completion: number;
}

// TODO: Add all additional callback fields here
export type HandleLLMNewTokenCallbackFields = {
  chunk?: GenerationChunk | ChatGenerationChunk;
};

/**
 * Abstract class that provides a set of optional methods that can be
 * overridden in derived classes to handle various events during the
 * execution of a LangChain application.
 */
abstract class BaseCallbackHandlerMethodsClass {
  /**
   * Called at the start of an LLM or Chat Model run, with the prompt(s)
   * and the run ID.
   */
  handleLLMStart?(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;

  /**
   * Called when an LLM/ChatModel in `streaming` mode produces a new token
   */
  handleLLMNewToken?(
    token: string,
    /**
     * idx.prompt is the index of the prompt that produced the token
     *   (if there are multiple prompts)
     * idx.completion is the index of the completion that produced the token
     *   (if multiple completions per prompt are requested)
     */
    idx: NewTokenIndices,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    fields?: HandleLLMNewTokenCallbackFields
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;

  /**
   * Called if an LLM/ChatModel run encounters an error
   */
  handleLLMError?(
    err: Error,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;

  /**
   * Called at the end of an LLM/ChatModel run, with the output and the run ID.
   */
  handleLLMEnd?(
    output: LLMResult,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;

  /**
   * Called at the start of a Chat Model run, with the prompt(s)
   * and the run ID.
   */
  handleChatModelStart?(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: Record<string, unknown>,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;

  /**
   * Called at the start of a Chain run, with the chain name and inputs
   * and the run ID.
   */
  handleChainStart?(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    runType?: string,
    name?: string
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;

  /**
   * Called if a Chain run encounters an error
   */
  handleChainError?(
    err: Error,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    kwargs?: { inputs?: Record<string, unknown> }
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;

  /**
   * Called at the end of a Chain run, with the outputs and the run ID.
   */
  handleChainEnd?(
    outputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    kwargs?: { inputs?: Record<string, unknown> }
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;

  /**
   * Called at the start of a Tool run, with the tool name and input
   * and the run ID.
   */
  handleToolStart?(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;

  /**
   * Called if a Tool run encounters an error
   */
  handleToolError?(
    err: Error,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;

  /**
   * Called at the end of a Tool run, with the tool output and the run ID.
   */
  handleToolEnd?(
    output: string,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;

  handleText?(
    text: string,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): Promise<void> | void;

  /**
   * Called when an agent is about to execute an action,
   * with the action and the run ID.
   */
  handleAgentAction?(
    action: AgentAction,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): Promise<void> | void;

  /**
   * Called when an agent finishes execution, before it exits.
   * with the final output and the run ID.
   */
  handleAgentEnd?(
    action: AgentFinish,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): Promise<void> | void;

  handleRetrieverStart?(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: Record<string, unknown>,
    name?: string
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;

  handleRetrieverEnd?(
    documents: Document[],
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;

  handleRetrieverError?(
    err: Error,
    runId: string,
    parentRunId?: string,
    tags?: string[]
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> | any;
}

/**
 * Base interface for callbacks. All methods are optional. If a method is not
 * implemented, it will be ignored. If a method is implemented, it will be
 * called at the appropriate time. All methods are called with the run ID of
 * the LLM/ChatModel/Chain that is running, which is generated by the
 * CallbackManager.
 *
 * @interface
 */
export type CallbackHandlerMethods = BaseCallbackHandlerMethodsClass;

/**
 * Abstract base class for creating callback handlers in the LangChain
 * framework. It provides a set of optional methods that can be overridden
 * in derived classes to handle various events during the execution of a
 * LangChain application.
 */
export abstract class BaseCallbackHandler
  extends BaseCallbackHandlerMethodsClass
  implements BaseCallbackHandlerInput, Serializable
{
  lc_serializable = false;

  get lc_namespace(): ["langchain_core", "callbacks", string] {
    return ["langchain_core", "callbacks", this.name];
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return undefined;
  }

  get lc_attributes(): { [key: string]: string } | undefined {
    return undefined;
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return undefined;
  }

  /**
   * The name of the serializable. Override to provide an alias or
   * to preserve the serialized module name in minified environments.
   *
   * Implemented as a static method to support loading logic.
   */
  static lc_name(): string {
    return this.name;
  }

  /**
   * The final serialized identifier for the module.
   */
  get lc_id(): string[] {
    return [
      ...this.lc_namespace,
      get_lc_unique_name(this.constructor as typeof BaseCallbackHandler),
    ];
  }

  lc_kwargs: SerializedFields;

  abstract name: string;

  ignoreLLM = false;

  ignoreChain = false;

  ignoreAgent = false;

  ignoreRetriever = false;

  awaitHandlers =
    typeof process !== "undefined"
      ? // eslint-disable-next-line no-process-env
        process.env?.LANGCHAIN_CALLBACKS_BACKGROUND !== "true"
      : true;

  constructor(input?: BaseCallbackHandlerInput) {
    super();
    this.lc_kwargs = input || {};
    if (input) {
      this.ignoreLLM = input.ignoreLLM ?? this.ignoreLLM;
      this.ignoreChain = input.ignoreChain ?? this.ignoreChain;
      this.ignoreAgent = input.ignoreAgent ?? this.ignoreAgent;
      this.ignoreRetriever = input.ignoreRetriever ?? this.ignoreRetriever;
    }
  }

  copy(): BaseCallbackHandler {
    return new (this.constructor as new (
      input?: BaseCallbackHandlerInput
    ) => BaseCallbackHandler)(this);
  }

  toJSON(): Serialized {
    return Serializable.prototype.toJSON.call(this);
  }

  toJSONNotImplemented(): SerializedNotImplemented {
    return Serializable.prototype.toJSONNotImplemented.call(this);
  }

  static fromMethods(methods: CallbackHandlerMethods) {
    class Handler extends BaseCallbackHandler {
      name = uuid.v4();

      constructor() {
        super();
        Object.assign(this, methods);
      }
    }
    return new Handler();
  }
}
