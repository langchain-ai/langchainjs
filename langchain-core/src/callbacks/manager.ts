import { v4 as uuidv4 } from "uuid";
import { AgentAction, AgentFinish } from "../agents.js";
import type { ChainValues } from "../utils/types.js";
import { LLMResult } from "../outputs.js";
import {
  BaseCallbackHandler,
  CallbackHandlerMethods,
  HandleLLMNewTokenCallbackFields,
  NewTokenIndices,
} from "./base.js";
import { ConsoleCallbackHandler } from "../tracers/console.js";
import {
  getTracingCallbackHandler,
  getTracingV2CallbackHandler,
} from "../tracers/initialize.js";
import { type BaseMessage, getBufferString } from "../messages/index.js";
import { getEnvironmentVariable } from "../utils/env.js";
import {
  LangChainTracer,
  LangChainTracerFields,
} from "../tracers/tracer_langchain.js";
import { consumeCallback } from "./promises.js";
import { Serialized } from "../load/serializable.js";
import type { DocumentInterface } from "../documents/document.js";

type BaseCallbackManagerMethods = {
  [K in keyof CallbackHandlerMethods]?: (
    ...args: Parameters<Required<CallbackHandlerMethods>[K]>
  ) => Promise<unknown>;
};

export interface CallbackManagerOptions {
  verbose?: boolean;
  tracing?: boolean;
}

export type Callbacks =
  | CallbackManager
  | (BaseCallbackHandler | CallbackHandlerMethods)[];

export interface BaseCallbackConfig {
  /**
   * Name for the tracer run for this call. Defaults to the name of the class.
   */
  runName?: string;

  /**
   * Tags for this call and any sub-calls (eg. a Chain calling an LLM).
   * You can use these to filter calls.
   */
  tags?: string[];

  /**
   * Metadata for this call and any sub-calls (eg. a Chain calling an LLM).
   * Keys should be strings, values should be JSON-serializable.
   */
  metadata?: Record<string, unknown>;

  /**
   * Callbacks for this call and any sub-calls (eg. a Chain calling an LLM).
   * Tags are passed to all callbacks, metadata is passed to handle*Start callbacks.
   */
  callbacks?: Callbacks;
}

export function parseCallbackConfigArg(
  arg: Callbacks | BaseCallbackConfig | undefined
): BaseCallbackConfig {
  if (!arg) {
    return {};
  } else if (Array.isArray(arg) || "name" in arg) {
    return { callbacks: arg };
  } else {
    return arg;
  }
}

/**
 * Manage callbacks from different components of LangChain.
 */
export abstract class BaseCallbackManager {
  abstract addHandler(handler: BaseCallbackHandler): void;

  abstract removeHandler(handler: BaseCallbackHandler): void;

  abstract setHandlers(handlers: BaseCallbackHandler[]): void;

  setHandler(handler: BaseCallbackHandler): void {
    return this.setHandlers([handler]);
  }
}

/**
 * Base class for run manager in LangChain.
 */
class BaseRunManager {
  constructor(
    public readonly runId: string,
    protected readonly handlers: BaseCallbackHandler[],
    protected readonly inheritableHandlers: BaseCallbackHandler[],
    protected readonly tags: string[],
    protected readonly inheritableTags: string[],
    protected readonly metadata: Record<string, unknown>,
    protected readonly inheritableMetadata: Record<string, unknown>,
    protected readonly _parentRunId?: string
  ) {}

  async handleText(text: string): Promise<void> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          try {
            await handler.handleText?.(
              text,
              this.runId,
              this._parentRunId,
              this.tags
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleText: ${err}`
            );
          }
        }, handler.awaitHandlers)
      )
    );
  }
}

/**
 * Manages callbacks for retriever runs.
 */
export class CallbackManagerForRetrieverRun
  extends BaseRunManager
  implements BaseCallbackManagerMethods
{
  getChild(tag?: string): CallbackManager {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const manager = new CallbackManager(this.runId);
    manager.setHandlers(this.inheritableHandlers);
    manager.addTags(this.inheritableTags);
    manager.addMetadata(this.inheritableMetadata);
    if (tag) {
      manager.addTags([tag], false);
    }
    return manager;
  }

  async handleRetrieverEnd(documents: DocumentInterface[]): Promise<void> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreRetriever) {
            try {
              await handler.handleRetrieverEnd?.(
                documents,
                this.runId,
                this._parentRunId,
                this.tags
              );
            } catch (err) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleRetriever`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
  }

  async handleRetrieverError(err: Error | unknown): Promise<void> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreRetriever) {
            try {
              await handler.handleRetrieverError?.(
                err,
                this.runId,
                this._parentRunId,
                this.tags
              );
            } catch (error) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleRetrieverError: ${error}`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
  }
}

export class CallbackManagerForLLMRun
  extends BaseRunManager
  implements BaseCallbackManagerMethods
{
  async handleLLMNewToken(
    token: string,
    idx?: NewTokenIndices,
    _runId?: string,
    _parentRunId?: string,
    _tags?: string[],
    fields?: HandleLLMNewTokenCallbackFields
  ): Promise<void> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreLLM) {
            try {
              await handler.handleLLMNewToken?.(
                token,
                idx ?? { prompt: 0, completion: 0 },
                this.runId,
                this._parentRunId,
                this.tags,
                fields
              );
            } catch (err) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleLLMNewToken: ${err}`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
  }

  async handleLLMError(err: Error | unknown): Promise<void> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreLLM) {
            try {
              await handler.handleLLMError?.(
                err,
                this.runId,
                this._parentRunId,
                this.tags
              );
            } catch (err) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleLLMError: ${err}`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
  }

  async handleLLMEnd(output: LLMResult): Promise<void> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreLLM) {
            try {
              await handler.handleLLMEnd?.(
                output,
                this.runId,
                this._parentRunId,
                this.tags
              );
            } catch (err) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleLLMEnd: ${err}`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
  }
}

export class CallbackManagerForChainRun
  extends BaseRunManager
  implements BaseCallbackManagerMethods
{
  getChild(tag?: string): CallbackManager {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const manager = new CallbackManager(this.runId);
    manager.setHandlers(this.inheritableHandlers);
    manager.addTags(this.inheritableTags);
    manager.addMetadata(this.inheritableMetadata);
    if (tag) {
      manager.addTags([tag], false);
    }
    return manager;
  }

  async handleChainError(
    err: Error | unknown,
    _runId?: string,
    _parentRunId?: string,
    _tags?: string[],
    kwargs?: { inputs?: Record<string, unknown> }
  ): Promise<void> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreChain) {
            try {
              await handler.handleChainError?.(
                err,
                this.runId,
                this._parentRunId,
                this.tags,
                kwargs
              );
            } catch (err) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleChainError: ${err}`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
  }

  async handleChainEnd(
    output: ChainValues,
    _runId?: string,
    _parentRunId?: string,
    _tags?: string[],
    kwargs?: { inputs?: Record<string, unknown> }
  ): Promise<void> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreChain) {
            try {
              await handler.handleChainEnd?.(
                output,
                this.runId,
                this._parentRunId,
                this.tags,
                kwargs
              );
            } catch (err) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleChainEnd: ${err}`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
  }

  async handleAgentAction(action: AgentAction): Promise<void> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreAgent) {
            try {
              await handler.handleAgentAction?.(
                action,
                this.runId,
                this._parentRunId,
                this.tags
              );
            } catch (err) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleAgentAction: ${err}`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
  }

  async handleAgentEnd(action: AgentFinish): Promise<void> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreAgent) {
            try {
              await handler.handleAgentEnd?.(
                action,
                this.runId,
                this._parentRunId,
                this.tags
              );
            } catch (err) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleAgentEnd: ${err}`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
  }
}

export class CallbackManagerForToolRun
  extends BaseRunManager
  implements BaseCallbackManagerMethods
{
  getChild(tag?: string): CallbackManager {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const manager = new CallbackManager(this.runId);
    manager.setHandlers(this.inheritableHandlers);
    manager.addTags(this.inheritableTags);
    manager.addMetadata(this.inheritableMetadata);
    if (tag) {
      manager.addTags([tag], false);
    }
    return manager;
  }

  async handleToolError(err: Error | unknown): Promise<void> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreAgent) {
            try {
              await handler.handleToolError?.(
                err,
                this.runId,
                this._parentRunId,
                this.tags
              );
            } catch (err) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleToolError: ${err}`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
  }

  async handleToolEnd(output: string): Promise<void> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreAgent) {
            try {
              await handler.handleToolEnd?.(
                output,
                this.runId,
                this._parentRunId,
                this.tags
              );
            } catch (err) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleToolEnd: ${err}`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
  }
}

/**
 * @example
 * ```typescript
 * const prompt = PromptTemplate.fromTemplate("What is the answer to {question}?");
 *
 * // Example of using LLMChain with OpenAI and a simple prompt
 * const chain = new LLMChain({
 *   llm: new ChatOpenAI({ temperature: 0.9 }),
 *   prompt,
 * });
 *
 * // Running the chain with a single question
 * const result = await chain.call({
 *   question: "What is the airspeed velocity of an unladen swallow?",
 * });
 * console.log("The answer is:", result);
 * ```
 */
export class CallbackManager
  extends BaseCallbackManager
  implements BaseCallbackManagerMethods
{
  handlers: BaseCallbackHandler[] = [];

  inheritableHandlers: BaseCallbackHandler[] = [];

  tags: string[] = [];

  inheritableTags: string[] = [];

  metadata: Record<string, unknown> = {};

  inheritableMetadata: Record<string, unknown> = {};

  name = "callback_manager";

  private readonly _parentRunId?: string;

  constructor(
    parentRunId?: string,
    options?: {
      handlers?: BaseCallbackHandler[];
      inheritableHandlers?: BaseCallbackHandler[];
      tags?: string[];
      inheritableTags?: string[];
      metadata?: Record<string, unknown>;
      inheritableMetadata?: Record<string, unknown>;
    }
  ) {
    super();
    this.handlers = options?.handlers ?? this.handlers;
    this.inheritableHandlers =
      options?.inheritableHandlers ?? this.inheritableHandlers;
    this.tags = options?.tags ?? this.tags;
    this.inheritableTags = options?.inheritableTags ?? this.inheritableTags;
    this.metadata = options?.metadata ?? this.metadata;
    this.inheritableMetadata =
      options?.inheritableMetadata ?? this.inheritableMetadata;
    this._parentRunId = parentRunId;
  }

  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    _runId: string | undefined = undefined,
    _parentRunId: string | undefined = undefined,
    extraParams: Record<string, unknown> | undefined = undefined,
    _tags: string[] | undefined = undefined,
    _metadata: Record<string, unknown> | undefined = undefined,
    runName: string | undefined = undefined
  ): Promise<CallbackManagerForLLMRun[]> {
    return Promise.all(
      prompts.map(async (prompt) => {
        const runId = uuidv4();

        await Promise.all(
          this.handlers.map((handler) =>
            consumeCallback(async () => {
              if (!handler.ignoreLLM) {
                try {
                  await handler.handleLLMStart?.(
                    llm,
                    [prompt],
                    runId,
                    this._parentRunId,
                    extraParams,
                    this.tags,
                    this.metadata,
                    runName
                  );
                } catch (err) {
                  console.error(
                    `Error in handler ${handler.constructor.name}, handleLLMStart: ${err}`
                  );
                }
              }
            }, handler.awaitHandlers)
          )
        );

        return new CallbackManagerForLLMRun(
          runId,
          this.handlers,
          this.inheritableHandlers,
          this.tags,
          this.inheritableTags,
          this.metadata,
          this.inheritableMetadata,
          this._parentRunId
        );
      })
    );
  }

  async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    _runId: string | undefined = undefined,
    _parentRunId: string | undefined = undefined,
    extraParams: Record<string, unknown> | undefined = undefined,
    _tags: string[] | undefined = undefined,
    _metadata: Record<string, unknown> | undefined = undefined,
    runName: string | undefined = undefined
  ): Promise<CallbackManagerForLLMRun[]> {
    return Promise.all(
      messages.map(async (messageGroup) => {
        const runId = uuidv4();

        await Promise.all(
          this.handlers.map((handler) =>
            consumeCallback(async () => {
              if (!handler.ignoreLLM) {
                try {
                  if (handler.handleChatModelStart) {
                    await handler.handleChatModelStart?.(
                      llm,
                      [messageGroup],
                      runId,
                      this._parentRunId,
                      extraParams,
                      this.tags,
                      this.metadata,
                      runName
                    );
                  } else if (handler.handleLLMStart) {
                    const messageString = getBufferString(messageGroup);
                    await handler.handleLLMStart?.(
                      llm,
                      [messageString],
                      runId,
                      this._parentRunId,
                      extraParams,
                      this.tags,
                      this.metadata,
                      runName
                    );
                  }
                } catch (err) {
                  console.error(
                    `Error in handler ${handler.constructor.name}, handleLLMStart: ${err}`
                  );
                }
              }
            }, handler.awaitHandlers)
          )
        );

        return new CallbackManagerForLLMRun(
          runId,
          this.handlers,
          this.inheritableHandlers,
          this.tags,
          this.inheritableTags,
          this.metadata,
          this.inheritableMetadata,
          this._parentRunId
        );
      })
    );
  }

  async handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId = uuidv4(),
    runType: string | undefined = undefined,
    _tags: string[] | undefined = undefined,
    _metadata: Record<string, unknown> | undefined = undefined,
    runName: string | undefined = undefined
  ): Promise<CallbackManagerForChainRun> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreChain) {
            try {
              await handler.handleChainStart?.(
                chain,
                inputs,
                runId,
                this._parentRunId,
                this.tags,
                this.metadata,
                runType,
                runName
              );
            } catch (err) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleChainStart: ${err}`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
    return new CallbackManagerForChainRun(
      runId,
      this.handlers,
      this.inheritableHandlers,
      this.tags,
      this.inheritableTags,
      this.metadata,
      this.inheritableMetadata,
      this._parentRunId
    );
  }

  async handleToolStart(
    tool: Serialized,
    input: string,
    runId = uuidv4(),
    _parentRunId: string | undefined = undefined,
    _tags: string[] | undefined = undefined,
    _metadata: Record<string, unknown> | undefined = undefined,
    runName: string | undefined = undefined
  ): Promise<CallbackManagerForToolRun> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreAgent) {
            try {
              await handler.handleToolStart?.(
                tool,
                input,
                runId,
                this._parentRunId,
                this.tags,
                this.metadata,
                runName
              );
            } catch (err) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleToolStart: ${err}`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
    return new CallbackManagerForToolRun(
      runId,
      this.handlers,
      this.inheritableHandlers,
      this.tags,
      this.inheritableTags,
      this.metadata,
      this.inheritableMetadata,
      this._parentRunId
    );
  }

  async handleRetrieverStart(
    retriever: Serialized,
    query: string,
    runId: string = uuidv4(),
    _parentRunId: string | undefined = undefined,
    _tags: string[] | undefined = undefined,
    _metadata: Record<string, unknown> | undefined = undefined,
    runName: string | undefined = undefined
  ): Promise<CallbackManagerForRetrieverRun> {
    await Promise.all(
      this.handlers.map((handler) =>
        consumeCallback(async () => {
          if (!handler.ignoreRetriever) {
            try {
              await handler.handleRetrieverStart?.(
                retriever,
                query,
                runId,
                this._parentRunId,
                this.tags,
                this.metadata,
                runName
              );
            } catch (err) {
              console.error(
                `Error in handler ${handler.constructor.name}, handleRetrieverStart: ${err}`
              );
            }
          }
        }, handler.awaitHandlers)
      )
    );
    return new CallbackManagerForRetrieverRun(
      runId,
      this.handlers,
      this.inheritableHandlers,
      this.tags,
      this.inheritableTags,
      this.metadata,
      this.inheritableMetadata,
      this._parentRunId
    );
  }

  addHandler(handler: BaseCallbackHandler, inherit = true): void {
    this.handlers.push(handler);
    if (inherit) {
      this.inheritableHandlers.push(handler);
    }
  }

  removeHandler(handler: BaseCallbackHandler): void {
    this.handlers = this.handlers.filter((_handler) => _handler !== handler);
    this.inheritableHandlers = this.inheritableHandlers.filter(
      (_handler) => _handler !== handler
    );
  }

  setHandlers(handlers: BaseCallbackHandler[], inherit = true): void {
    this.handlers = [];
    this.inheritableHandlers = [];
    for (const handler of handlers) {
      this.addHandler(handler, inherit);
    }
  }

  addTags(tags: string[], inherit = true): void {
    this.removeTags(tags); // Remove duplicates
    this.tags.push(...tags);
    if (inherit) {
      this.inheritableTags.push(...tags);
    }
  }

  removeTags(tags: string[]): void {
    this.tags = this.tags.filter((tag) => !tags.includes(tag));
    this.inheritableTags = this.inheritableTags.filter(
      (tag) => !tags.includes(tag)
    );
  }

  addMetadata(metadata: Record<string, unknown>, inherit = true): void {
    this.metadata = { ...this.metadata, ...metadata };
    if (inherit) {
      this.inheritableMetadata = { ...this.inheritableMetadata, ...metadata };
    }
  }

  removeMetadata(metadata: Record<string, unknown>): void {
    for (const key of Object.keys(metadata)) {
      delete this.metadata[key];
      delete this.inheritableMetadata[key];
    }
  }

  copy(
    additionalHandlers: BaseCallbackHandler[] = [],
    inherit = true
  ): CallbackManager {
    const manager = new CallbackManager(this._parentRunId);
    for (const handler of this.handlers) {
      const inheritable = this.inheritableHandlers.includes(handler);
      manager.addHandler(handler, inheritable);
    }
    for (const tag of this.tags) {
      const inheritable = this.inheritableTags.includes(tag);
      manager.addTags([tag], inheritable);
    }
    for (const key of Object.keys(this.metadata)) {
      const inheritable = Object.keys(this.inheritableMetadata).includes(key);
      manager.addMetadata({ [key]: this.metadata[key] }, inheritable);
    }
    for (const handler of additionalHandlers) {
      if (
        // Prevent multiple copies of console_callback_handler
        manager.handlers
          .filter((h) => h.name === "console_callback_handler")
          .some((h) => h.name === handler.name)
      ) {
        continue;
      }
      manager.addHandler(handler, inherit);
    }
    return manager;
  }

  static fromHandlers(handlers: CallbackHandlerMethods) {
    class Handler extends BaseCallbackHandler {
      name = uuidv4();

      constructor() {
        super();
        Object.assign(this, handlers);
      }
    }

    const manager = new this();
    manager.addHandler(new Handler());
    return manager;
  }

  static async configure(
    inheritableHandlers?: Callbacks,
    localHandlers?: Callbacks,
    inheritableTags?: string[],
    localTags?: string[],
    inheritableMetadata?: Record<string, unknown>,
    localMetadata?: Record<string, unknown>,
    options?: CallbackManagerOptions
  ): Promise<CallbackManager | undefined> {
    let callbackManager: CallbackManager | undefined;
    if (inheritableHandlers || localHandlers) {
      if (Array.isArray(inheritableHandlers) || !inheritableHandlers) {
        callbackManager = new CallbackManager();
        callbackManager.setHandlers(
          inheritableHandlers?.map(ensureHandler) ?? [],
          true
        );
      } else {
        callbackManager = inheritableHandlers;
      }
      callbackManager = callbackManager.copy(
        Array.isArray(localHandlers)
          ? localHandlers.map(ensureHandler)
          : localHandlers?.handlers,
        false
      );
    }

    const verboseEnabled =
      getEnvironmentVariable("LANGCHAIN_VERBOSE") === "true" ||
      options?.verbose;
    const tracingV2Enabled =
      getEnvironmentVariable("LANGCHAIN_TRACING_V2") === "true";

    const tracingEnabled =
      tracingV2Enabled ||
      (getEnvironmentVariable("LANGCHAIN_TRACING") ?? false);
    if (verboseEnabled || tracingEnabled) {
      if (!callbackManager) {
        callbackManager = new CallbackManager();
      }
      if (
        verboseEnabled &&
        !callbackManager.handlers.some(
          (handler) => handler.name === ConsoleCallbackHandler.prototype.name
        )
      ) {
        const consoleHandler = new ConsoleCallbackHandler();
        callbackManager.addHandler(consoleHandler, true);
      }
      if (
        tracingEnabled &&
        !callbackManager.handlers.some(
          (handler) => handler.name === "langchain_tracer"
        )
      ) {
        if (tracingV2Enabled) {
          callbackManager.addHandler(await getTracingV2CallbackHandler(), true);
        } else {
          const session =
            getEnvironmentVariable("LANGCHAIN_PROJECT") &&
            getEnvironmentVariable("LANGCHAIN_SESSION");
          callbackManager.addHandler(
            await getTracingCallbackHandler(session),
            true
          );
        }
      }
    }
    if (inheritableTags || localTags) {
      if (callbackManager) {
        callbackManager.addTags(inheritableTags ?? []);
        callbackManager.addTags(localTags ?? [], false);
      }
    }
    if (inheritableMetadata || localMetadata) {
      if (callbackManager) {
        callbackManager.addMetadata(inheritableMetadata ?? {});
        callbackManager.addMetadata(localMetadata ?? {}, false);
      }
    }
    return callbackManager;
  }
}

function ensureHandler(
  handler: BaseCallbackHandler | CallbackHandlerMethods
): BaseCallbackHandler {
  if ("name" in handler) {
    return handler;
  }

  return BaseCallbackHandler.fromMethods(handler);
}

/**
 * @example
 * ```typescript
 * const prompt = PromptTemplate.fromTemplate(`What is the answer to {question}?`);
 *
 * // Example of using LLMChain to process a series of questions
 * const chain = new LLMChain({
 *   llm: new ChatOpenAI({ temperature: 0.9 }),
 *   prompt,
 * });
 *
 * // Process questions using the chain
 * const processQuestions = async (questions) => {
 *   for (const question of questions) {
 *     const result = await chain.call({ question });
 *     console.log(result);
 *   }
 * };
 *
 * // Example questions
 * const questions = [
 *   "What is your name?",
 *   "What is your quest?",
 *   "What is your favorite color?",
 * ];
 *
 * // Run the example
 * processQuestions(questions).catch(console.error);
 *
 * ```
 */
export class TraceGroup {
  private runManager?: CallbackManagerForChainRun;

  constructor(
    private groupName: string,
    private options?: {
      projectName?: string;
      exampleId?: string;
    }
  ) {}

  private async getTraceGroupCallbackManager(
    group_name: string,
    inputs?: ChainValues,
    options?: LangChainTracerFields
  ): Promise<CallbackManagerForChainRun> {
    const cb = new LangChainTracer(options);
    const cm = await CallbackManager.configure([cb]);
    const runManager = await cm?.handleChainStart(
      {
        lc: 1,
        type: "not_implemented",
        id: ["langchain", "callbacks", "groups", group_name],
      },
      inputs ?? {}
    );
    if (!runManager) {
      throw new Error("Failed to create run group callback manager.");
    }
    return runManager;
  }

  async start(inputs?: ChainValues): Promise<CallbackManager> {
    if (!this.runManager) {
      this.runManager = await this.getTraceGroupCallbackManager(
        this.groupName,
        inputs,
        this.options
      );
    }
    return this.runManager.getChild();
  }

  async error(err: Error | unknown): Promise<void> {
    if (this.runManager) {
      await this.runManager.handleChainError(err);
      this.runManager = undefined;
    }
  }

  async end(output?: ChainValues): Promise<void> {
    if (this.runManager) {
      await this.runManager.handleChainEnd(output ?? {});
      this.runManager = undefined;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _coerceToDict(value: any, defaultKey: string) {
  return value && !Array.isArray(value) && typeof value === "object"
    ? value
    : { [defaultKey]: value };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function traceAsGroup<T, A extends any[]>(
  groupOptions: {
    name: string;
  } & LangChainTracerFields,
  enclosedCode: (manager: CallbackManager, ...args: A) => Promise<T>,
  ...args: A
): Promise<T> {
  const traceGroup = new TraceGroup(groupOptions.name, groupOptions);
  const callbackManager = await traceGroup.start({ ...args });
  try {
    const result = await enclosedCode(callbackManager, ...args);
    await traceGroup.end(_coerceToDict(result, "output"));
    return result;
  } catch (err) {
    await traceGroup.error(err);
    throw err;
  }
}
